import express from 'express';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('Doctor'));

// Helper to get doctor ID from user ID
const getDoctorId = async (userId) => {
    const [doctors] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
    if (doctors.length === 0) throw new Error('Doctor profile not found.');
    return doctors[0].id;
};

// 1. Get Doctor's Appointments
router.get('/appointments', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const [appointments] = await pool.query(
            `SELECT a.*, u.full_name as patient_name, p.phone as patient_phone, p.blood_group 
             FROM appointments a 
             JOIN patients p ON a.patient_id = p.id 
             JOIN users u ON p.user_id = u.id 
             WHERE a.doctor_id = ? 
             ORDER BY a.appointment_date DESC`,
            [doctorId]
        );
        res.json(appointments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to retrieve appointments.' });
    }
});

// 2. Load Medicines and Lab Tests catalog for consult forms
router.get('/consultation-assets', async (req, res) => {
    try {
        const [medicines] = await pool.query('SELECT id, name, unit_price, quantity FROM medicines');
        const [labTests] = await pool.query('SELECT * FROM lab_tests');
        res.json({ medicines, lab_tests: labTests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve clinical assets.' });
    }
});

// 3. Complete Patient OPD Consultation (clinical record, prescription, lab orders, follow-up)
router.post('/consult', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const doctorId = await getDoctorId(req.user.id);
        const {
            appointment_id,
            patient_id,
            diagnosis,
            clinical_notes,
            prescriptions, // Array of { medicine_id, dosage, duration, quantity }
            lab_requests, // Array of lab_test_id
            followup_date,
            followup_time
        } = req.body;

        if (!patient_id || !diagnosis) {
            return res.status(400).json({ error: 'Patient ID and Diagnosis are required fields.' });
        }

        // 1. Mark Appointment as Completed
        if (appointment_id) {
            await connection.query('UPDATE appointments SET status = "Completed" WHERE id = ?', [appointment_id]);
        }

        // 2. Create Medical Record
        const recordDate = new Date().toISOString().split('T')[0];
        const [recordResult] = await connection.query(
            'INSERT INTO medical_records (appointment_id, patient_id, doctor_id, diagnosis, clinical_notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [appointment_id || null, patient_id, doctorId, diagnosis, clinical_notes || '', recordDate]
        );
        const recordId = recordResult.insertId;

        // 3. Process Prescriptions if provided
        if (prescriptions && prescriptions.length > 0) {
            const [prescResult] = await connection.query(
                'INSERT INTO prescriptions (medical_record_id, instructions) VALUES (?, ?)',
                [recordId, 'Take medicines as directed in the item list.']
            );
            const prescriptionId = prescResult.insertId;

            for (const item of prescriptions) {
                if (item.medicine_id) {
                    await connection.query(
                        'INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity) VALUES (?, ?, ?, ?, ?)',
                        [prescriptionId, item.medicine_id, item.dosage, item.duration, item.quantity]
                    );
                }
            }
        }

        // 4. Process Lab Requests
        if (lab_requests && lab_requests.length > 0) {
            for (const testId of lab_requests) {
                await connection.query(
                    'INSERT INTO lab_requests (appointment_id, patient_id, doctor_id, lab_test_id, status, notes, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [appointment_id || null, patient_id, doctorId, testId, 'Scheduled', 'Requested by consulting doctor.', recordDate]
                );
            }
        }

        // 5. Schedule Proposed Follow-up
        if (followup_date && followup_time) {
            // Fetch patient's department
            const [docInfo] = await connection.query('SELECT department_id FROM doctors WHERE id = ?', [doctorId]);
            const deptId = docInfo[0].department_id;

            // Simple incremental token generator for follow-up date
            const [existing] = await connection.query('SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?', [doctorId, followup_date]);
            const token = existing[0].count + 1;

            await connection.query(
                'INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [patient_id, doctorId, deptId, followup_date, followup_time, token, 'Proposed', 'OPD follow-up proposed by doctor.']
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'OPD Consultation saved successfully.', recordId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to record consultation.' });
    } finally {
        connection.release();
    }
});

// 4. Get Availability Settings
router.get('/availability', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const [doctors] = await pool.query('SELECT availability, available_days, start_time, end_time, slot_duration FROM doctors WHERE id = ?', [doctorId]);
        
        // Get leave dates
        const [leaves] = await pool.query('SELECT date FROM doctor_availability WHERE doctor_id = ? AND type = "Leave" AND status = "Active"', [doctorId]);
        
        res.json({
            settings: doctors[0],
            leaves: leaves.map(l => l.date.toISOString().split('T')[0])
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to fetch availability.' });
    }
});

// 5. Update Availability Settings
router.post('/availability', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const { availability_text, available_days, start_time, end_time, slot_duration } = req.body;

        await pool.query(
            `UPDATE doctors 
             SET availability = ?, available_days = ?, start_time = ?, end_time = ?, slot_duration = ? 
             WHERE id = ?`,
            [availability_text, JSON.stringify(available_days), start_time, end_time, slot_duration, doctorId]
        );

        res.json({ message: 'OPD scheduling availability updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
});

// 6. Manage Doctor Leaves (Add Leave)
router.post('/leave', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const { date } = req.body;
        if (!date) return res.status(400).json({ error: 'Leave date is required.' });

        // Check if leave already exists
        const [existing] = await pool.query('SELECT id FROM doctor_availability WHERE doctor_id = ? AND date = ? AND type = "Leave"', [doctorId, date]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Leave already logged for this date.' });
        }

        await pool.query(
            'INSERT INTO doctor_availability (doctor_id, type, date) VALUES (?, "Leave", ?)',
            [doctorId, date]
        );
        res.status(201).json({ message: 'Leave recorded successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to record leave.' });
    }
});

// 7. Remove Doctor Leave
router.delete('/leave/:date', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        await pool.query(
            'DELETE FROM doctor_availability WHERE doctor_id = ? AND date = ? AND type = "Leave"',
            [doctorId, req.params.date]
        );
        res.json({ message: 'Leave cancelled.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete leave.' });
    }
});

// 8. Chat: Contacts list (Patients consulting)
router.get('/chat-contacts', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const [patients] = await pool.query(
            `SELECT DISTINCT p.id as patient_id, u.id as user_id, u.full_name, p.phone 
             FROM appointments a 
             JOIN patients p ON a.patient_id = p.id 
             JOIN users u ON p.user_id = u.id 
             WHERE a.doctor_id = ?`,
            [doctorId]
        );
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch chat contacts.' });
    }
});

// 9. Chat: Message History
router.get('/chat/:patientUserId', async (req, res) => {
    try {
        const [messages] = await pool.query(
            'SELECT * FROM chat_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC',
            [req.user.id, req.params.patientUserId, req.params.patientUserId, req.user.id]
        );
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
});

// 10. Chat: Send Message
router.post('/chat', async (req, res) => {
    try {
        const { receiver_id, message } = req.body;
        if (!receiver_id || !message) {
            return res.status(400).json({ error: 'Receiver ID and message content are required.' });
        }

        await pool.query(
            'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.user.id, receiver_id, message]
        );
        res.status(201).json({ message: 'Message sent successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to dispatch message.' });
    }
});

export default router;

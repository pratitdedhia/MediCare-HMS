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

// 1. Get Doctor's Appointments (with shared records count)
router.get('/appointments', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const [appointments] = await pool.query(
            `SELECT a.*, u.full_name as patient_name, p.phone as patient_phone, p.blood_group,
                    (SELECT COUNT(*) FROM appointment_shared_records asr WHERE asr.appointment_id = a.id) as shared_records_count
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

// 1B. Get Specific Appointment Details & Shared Medical Records
router.get('/appointments/:id', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const appointmentId = req.params.id;

        // Verify doctor owns appointment
        const [appointments] = await pool.query(
            `SELECT a.*, u.full_name as patient_name, u.email as patient_email, p.phone as patient_phone, 
                    p.dob as patient_dob, p.gender as patient_gender, p.blood_group, p.emergency_contact, 
                    p.medical_history, p.address as patient_address
             FROM appointments a 
             JOIN patients p ON a.patient_id = p.id 
             JOIN users u ON p.user_id = u.id 
             WHERE a.id = ? AND a.doctor_id = ?`,
            [appointmentId, doctorId]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ error: 'Appointment not found or unauthorized access.' });
        }

        const appointment = appointments[0];

        // Fetch shared records for this specific appointment
        const [sharedRecords] = await pool.query(
            `SELECT asr.id as share_id, asr.category as shared_category, asr.shared_at,
                    pd.id as document_id, pd.title, pd.category, pd.document_type, pd.source,
                    pd.doctor_name, pd.facility_name, pd.document_date, pd.file_url, pd.notes
             FROM appointment_shared_records asr
             JOIN patient_documents pd ON asr.document_id = pd.id
             WHERE asr.appointment_id = ?`,
            [appointmentId]
        );

        const sharedReports = sharedRecords.filter(r => r.shared_category === 'Report' || r.category === 'Report');
        const sharedPrescriptions = sharedRecords.filter(r => r.shared_category !== 'Report' && r.category !== 'Report');

        // Fetch saved consultation record if completed
        let consultation = null;
        const [records] = await pool.query(
            'SELECT * FROM medical_records WHERE appointment_id = ?',
            [appointmentId]
        );

        if (records.length > 0) {
            consultation = records[0];

            // Fetch prescriptions
            const [prescriptions] = await pool.query(
                'SELECT * FROM prescriptions WHERE medical_record_id = ?',
                [consultation.id]
            );

            if (prescriptions.length > 0) {
                const prescId = prescriptions[0].id;
                const [items] = await pool.query(
                    `SELECT pi.*, m.name as medicine_name, m.brand 
                     FROM prescription_items pi 
                     JOIN medicines m ON pi.medicine_id = m.id 
                     WHERE pi.prescription_id = ?`,
                    [prescId]
                );
                consultation.prescription = {
                    ...prescriptions[0],
                    items
                };
            }

            // Fetch lab requests
            const [labReqs] = await pool.query(
                `SELECT lr.*, lt.test_name, lt.cost 
                 FROM lab_requests lr 
                 JOIN lab_tests lt ON lr.lab_test_id = lt.id 
                 WHERE lr.appointment_id = ?`,
                [appointmentId]
            );
            consultation.lab_requests = labReqs;
        }

        // Fetch patient's chronic illnesses
        const [illnesses] = await pool.query(
            'SELECT * FROM patient_illnesses WHERE patient_id = ?',
            [appointment.patient_id]
        );

        // Fetch patient's insurance policies
        const [insurance] = await pool.query(
            'SELECT * FROM insurance_policies WHERE patient_id = ?',
            [appointment.patient_id]
        );

        res.json({
            appointment,
            shared_records: {
                total_count: sharedRecords.length,
                reports: sharedReports,
                prescriptions: sharedPrescriptions,
                all: sharedRecords
            },
            consultation,
            patient_illnesses: illnesses,
            patient_insurance: insurance
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve appointment details.' });
    }
});

// 1C. Get Shared Records for an Appointment (Standalone Route)
router.get('/appointments/:id/shared-records', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const appointmentId = req.params.id;

        // Verify doctor assignment
        const [aptCheck] = await pool.query(
            'SELECT id, patient_id FROM appointments WHERE id = ? AND doctor_id = ?',
            [appointmentId, doctorId]
        );

        if (aptCheck.length === 0) {
            return res.status(403).json({ error: 'Access denied. You are not assigned to this appointment.' });
        }

        const [sharedRecords] = await pool.query(
            `SELECT asr.id as share_id, asr.category as shared_category, asr.shared_at,
                    pd.id as document_id, pd.title, pd.category, pd.document_type, pd.source,
                    pd.doctor_name, pd.facility_name, pd.document_date, pd.file_url, pd.notes
             FROM appointment_shared_records asr
             JOIN patient_documents pd ON asr.document_id = pd.id
             WHERE asr.appointment_id = ?`,
            [appointmentId]
        );

        res.json({
            appointment_id: appointmentId,
            total_shared: sharedRecords.length,
            reports: sharedRecords.filter(r => r.shared_category === 'Report' || r.category === 'Report'),
            prescriptions: sharedRecords.filter(r => r.shared_category !== 'Report' && r.category !== 'Report')
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve shared records.' });
    }
});

// 1D. Get Patient's Full Historical Consultation & Prescription Records (Read-Only)
router.get('/patient-history/:patientId', async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const patientId = req.params.patientId;

        // Authorization check: Verify doctor has at least one appointment with this patient
        const [accessCheck] = await pool.query(
            'SELECT id FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1',
            [doctorId, patientId]
        );

        if (accessCheck.length === 0) {
            return res.status(403).json({ error: 'Access denied. No active clinical appointment relation with this patient.' });
        }

        // Fetch all previous medical records across all consulting doctors
        const [records] = await pool.query(
            `SELECT mr.*, u.full_name as consulting_doctor, d.specialization as doctor_specialization,
                    dept.name as department_name, a.appointment_date, a.appointment_time
             FROM medical_records mr
             JOIN doctors d ON mr.doctor_id = d.id
             JOIN users u ON d.user_id = u.id
             JOIN departments dept ON d.department_id = dept.id
             LEFT JOIN appointments a ON mr.appointment_id = a.id
             WHERE mr.patient_id = ?
             ORDER BY mr.created_at DESC`,
            [patientId]
        );

        // Fetch all prescriptions and their items
        const recordIds = records.map(r => r.id);
        let prescriptions = [];
        let prescriptionItems = [];

        if (recordIds.length > 0) {
            [prescriptions] = await pool.query(
                'SELECT * FROM prescriptions WHERE medical_record_id IN (?)',
                [recordIds]
            );

            const prescIds = prescriptions.map(p => p.id);
            if (prescIds.length > 0) {
                [prescriptionItems] = await pool.query(
                    `SELECT pi.*, m.name as medicine_name, m.brand 
                     FROM prescription_items pi 
                     JOIN medicines m ON pi.medicine_id = m.id 
                     WHERE pi.prescription_id IN (?)`,
                    [prescIds]
                );
            }
        }

        const history = records.map(r => {
            const presc = prescriptions.find(p => p.medical_record_id === r.id);
            return {
                ...r,
                prescription: presc ? {
                    ...presc,
                    items: prescriptionItems.filter(i => i.prescription_id === presc.id)
                } : null
            };
        });

        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve patient consultation history.' });
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
            chief_complaint,
            examination_findings,
            diagnosis,
            clinical_notes,
            followup_instructions,
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
            `INSERT INTO medical_records 
             (appointment_id, patient_id, doctor_id, chief_complaint, examination_findings, diagnosis, clinical_notes, followup_instructions, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [appointment_id || null, patient_id, doctorId, chief_complaint || '', examination_findings || '', diagnosis, clinical_notes || '', followup_instructions || '', recordDate]
        );
        const recordId = recordResult.insertId;

        // 3. Process Prescriptions if provided
        if (prescriptions && prescriptions.length > 0) {
            const [prescResult] = await connection.query(
                'INSERT INTO prescriptions (medical_record_id, instructions) VALUES (?, ?)',
                [recordId, followup_instructions || 'Take medicines as directed in the item list.']
            );
            const prescriptionId = prescResult.insertId;

            for (const item of prescriptions) {
                if (item.medicine_id) {
                    await connection.query(
                        'INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity) VALUES (?, ?, ?, ?, ?)',
                        [prescriptionId, item.medicine_id, item.dosage, item.duration, item.quantity || 1]
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
            const todayStr = new Date().toISOString().split('T')[0];
            if (followup_date >= todayStr) {
                // Fetch patient's department
                const [docInfo] = await connection.query('SELECT department_id FROM doctors WHERE id = ?', [doctorId]);
                const deptId = docInfo[0].department_id;

                // Simple incremental token generator for follow-up date
                const [existing] = await connection.query('SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?', [doctorId, followup_date]);
                const token = existing[0].count + 1;

                await connection.query(
                    'INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [patient_id, doctorId, deptId, followup_date, followup_time, token, 'Proposed', 'Follow-up Consultation', `OPD follow-up proposed for diagnosis: ${diagnosis}`]
                );
            }
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

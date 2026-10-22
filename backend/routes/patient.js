import express from 'express';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all patient routes
router.use(authenticateToken);
router.use(authorizeRoles('Patient'));

// 1. Get Profile Details
router.get('/profile', async (req, res) => {
    try {
        const [patients] = await pool.query(
            'SELECT p.*, u.full_name, u.email FROM patients p JOIN users u ON p.user_id = u.id WHERE u.id = ?',
            [req.user.id]
        );
        if (patients.length === 0) {
            return res.status(404).json({ error: 'Patient profile not found.' });
        }
        
        const patient = patients[0];
        
        // Get insurance policies
        const [policies] = await pool.query('SELECT * FROM insurance_policies WHERE patient_id = ?', [patient.id]);
        
        // Get past illnesses
        const [illnesses] = await pool.query('SELECT * FROM patient_illnesses WHERE patient_id = ?', [patient.id]);

        const formatDateStr = (val) => {
            if (!val) return null;
            if (val instanceof Date) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return String(val).split('T')[0];
        };

        // Doctor visit stats grouped by doctor:
        // Only count actual completed visits (status = 'Completed'). Scheduled, Proposed, and Cancelled are excluded.
        // Group by doctor with tie-breaking: highest visits first, then most recent appointment date, then doctor ID
        const [doctorVisitStats] = await pool.query(`
            SELECT 
                d.id AS doctor_id,
                d.user_id,
                d.department_id,
                d.specialization,
                d.fee,
                d.room_no,
                d.availability,
                u.full_name AS doctor_name,
                dept.name AS department_name,
                COUNT(a.id) AS visit_count,
                MAX(a.appointment_date) AS last_visited_date
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            WHERE a.patient_id = ? AND a.status = 'Completed'
            GROUP BY d.id, d.user_id, d.department_id, d.specialization, d.fee, d.room_no, d.availability, u.full_name, dept.name
            ORDER BY visit_count DESC, last_visited_date DESC, d.id ASC
        `, [patient.id]);

        let mostVisitedDoctor = null;
        if (doctorVisitStats.length > 0) {
            const top = doctorVisitStats[0];
            mostVisitedDoctor = {
                doctor_id: top.doctor_id,
                doctor_name: top.doctor_name,
                department_name: top.department_name || 'General Medicine',
                specialization: top.specialization || 'Consultant Physician',
                fee: parseFloat(top.fee) || 0,
                room_no: top.room_no || 'Consultation Desk',
                availability: top.availability,
                visit_count: Number(top.visit_count),
                last_visited_date: formatDateStr(top.last_visited_date)
            };
        }

        // Latest completed visit for Recently Visited Doctor
        // Based on chronological appointment_date and appointment_time, not arbitrary row return order
        const [recentVisits] = await pool.query(`
            SELECT 
                d.id AS doctor_id,
                d.user_id,
                d.department_id,
                d.specialization,
                d.fee,
                d.room_no,
                d.availability,
                u.full_name AS doctor_name,
                dept.name AS department_name,
                a.appointment_date AS last_visited_date,
                a.appointment_time AS last_visited_time
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            WHERE a.patient_id = ? AND a.status = 'Completed'
            ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC
            LIMIT 1
        `, [patient.id]);

        let recentlyVisitedDoctor = null;
        if (recentVisits.length > 0) {
            const recent = recentVisits[0];
            const matchingStat = doctorVisitStats.find(s => s.doctor_id === recent.doctor_id);
            recentlyVisitedDoctor = {
                doctor_id: recent.doctor_id,
                doctor_name: recent.doctor_name,
                department_name: recent.department_name || 'General Medicine',
                specialization: recent.specialization || 'Consultant Physician',
                fee: parseFloat(recent.fee) || 0,
                room_no: recent.room_no || 'Consultation Desk',
                availability: recent.availability,
                visit_count: matchingStat ? Number(matchingStat.visit_count) : 1,
                last_visited_date: formatDateStr(recent.last_visited_date),
                last_visited_time: recent.last_visited_time || ''
            };
        }

        const totalCompletedVisits = doctorVisitStats.reduce((sum, s) => sum + Number(s.visit_count), 0);
        
        res.json({
            patient,
            insurance_policies: policies,
            past_illnesses: illnesses,
            most_visited_doctor: mostVisitedDoctor,
            recently_visited_doctor: recentlyVisitedDoctor,
            total_completed_visits: totalCompletedVisits
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 2. Update Profile Details
router.put('/profile', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { full_name, email, phone, dob, gender, blood_group, emergency_contact, address } = req.body;

        if (!full_name || !email || !phone) {
            return res.status(400).json({ error: 'Name, email, and phone are required.' });
        }

        // Update users table
        await connection.query(
            'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
            [full_name, email, req.user.id]
        );

        // Update patients table
        await connection.query(
            'UPDATE patients SET phone = ?, dob = ?, gender = ?, blood_group = ?, emergency_contact = ?, address = ?, incomplete = FALSE WHERE user_id = ?',
            [phone, dob || null, gender || null, blood_group || null, emergency_contact || null, address || null, req.user.id]
        );

        await connection.commit();
        res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile.' });
    } finally {
        connection.release();
    }
});

// 3. Add Insurance Policy
router.post('/insurance', async (req, res) => {
    try {
        const { provider, policy_no, coverage } = req.body;
        if (!provider || !policy_no || !coverage) {
            return res.status(400).json({ error: 'Provider, policy number, and coverage amount are required.' });
        }

        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not found.' });
        const patientId = patients[0].id;

        await pool.query(
            'INSERT INTO insurance_policies (patient_id, provider, policy_no, coverage) VALUES (?, ?, ?, ?)',
            [patientId, provider, policy_no, coverage]
        );
        res.status(201).json({ message: 'Insurance policy linked.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add insurance.' });
    }
});

// 4. Delete Insurance Policy
router.delete('/insurance/:id', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        await pool.query('DELETE FROM insurance_policies WHERE id = ? AND patient_id = ?', [req.params.id, patientId]);
        res.json({ message: 'Insurance policy removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove insurance.' });
    }
});

// 5. Add Past Illness Condition
router.post('/illness', async (req, res) => {
    try {
        const { condition_name, year, status, remarks } = req.body;
        if (!condition_name || !year || !status) {
            return res.status(400).json({ error: 'Condition name, year, and status are required.' });
        }

        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        await pool.query(
            'INSERT INTO patient_illnesses (patient_id, condition_name, year, status, remarks) VALUES (?, ?, ?, ?, ?)',
            [patientId, condition_name, year, status, remarks || '']
        );
        res.status(201).json({ message: 'Chronic condition logged.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to log illness.' });
    }
});

// 6. Delete Past Illness
router.delete('/illness/:id', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        await pool.query('DELETE FROM patient_illnesses WHERE id = ? AND patient_id = ?', [req.params.id, patientId]);
        res.json({ message: 'Condition removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove condition.' });
    }
});

// 7. Get Clinical Information (Doctors and Departments)
router.get('/clinical-info', async (req, res) => {
    try {
        const [departments] = await pool.query('SELECT * FROM departments');
        const [doctors] = await pool.query(
            'SELECT d.*, u.full_name, dept.name as department_name FROM doctors d JOIN users u ON d.user_id = u.id JOIN departments dept ON d.department_id = dept.id'
        );
        res.json({ departments, doctors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve clinical info.' });
    }
});

// 8. Book Doctor Appointment
router.post('/book-appointment', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            doctor_id,
            appointment_date,
            appointment_time,
            reason,
            consultation_type,
            record_sharing_consent,
            shared_report_ids,
            shared_prescription_ids,
            payment_status,
            payment_method,
            payment_details
        } = req.body;

        if (!doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'Doctor ID, date, and slot time are required.' });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (appointment_date < todayStr) {
            return res.status(400).json({ error: 'Cannot book appointments for past dates. Please select today or a future date.' });
        }

        // Get patient ID
        const [patients] = await connection.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not registered.' });
        const patientId = patients[0].id;

        // Get doctor details for fee and department
        const [doctors] = await connection.query('SELECT department_id, fee FROM doctors WHERE id = ?', [doctor_id]);
        if (doctors.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
        const { department_id, fee } = doctors[0];

        // Generate token
        const [existing] = await connection.query('SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?', [doctor_id, appointment_date]);
        const token = existing[0].count + 1;

        // Create appointment with sharing consent
        const isConsentGiven = record_sharing_consent === true || record_sharing_consent === 'true' || record_sharing_consent === 1;
        const consultType = consultation_type || 'OPD Consultation';

        const [aptResult] = await connection.query(
            `INSERT INTO appointments 
             (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason, record_sharing_consent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [patientId, doctor_id, department_id, appointment_date, appointment_time, token, payment_status === 'Paid' ? 'Scheduled' : 'Scheduled', consultType, reason || 'Routine consultation', isConsentGiven]
        );
        const appointmentId = aptResult.insertId;

        // Persist shared records references if consent was given
        let sharedCount = 0;
        if (isConsentGiven) {
            const reportsToShare = Array.isArray(shared_report_ids) ? shared_report_ids : [];
            const prescriptionsToShare = Array.isArray(shared_prescription_ids) ? shared_prescription_ids : [];

            for (const docId of reportsToShare) {
                // Validate patient ownership
                const [docMatch] = await connection.query('SELECT id, category FROM patient_documents WHERE id = ? AND patient_id = ?', [docId, patientId]);
                if (docMatch.length > 0) {
                    await connection.query(
                        'INSERT INTO appointment_shared_records (appointment_id, patient_id, doctor_id, document_id, category) VALUES (?, ?, ?, ?, ?)',
                        [appointmentId, patientId, doctor_id, docId, 'Report']
                    );
                    sharedCount++;
                }
            }

            for (const docId of prescriptionsToShare) {
                // Validate patient ownership
                const [docMatch] = await connection.query('SELECT id, category FROM patient_documents WHERE id = ? AND patient_id = ?', [docId, patientId]);
                if (docMatch.length > 0) {
                    await connection.query(
                        'INSERT INTO appointment_shared_records (appointment_id, patient_id, doctor_id, document_id, category) VALUES (?, ?, ?, ?, ?)',
                        [appointmentId, patientId, doctor_id, docId, docMatch[0].category || 'Prescription']
                    );
                    sharedCount++;
                }
            }
        }

        // Generate Bill
        const [billResult] = await connection.query(
            'INSERT INTO bills (patient_id, appointment_id, total_amount, net_amount, status, payment_method, payment_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [patientId, appointmentId, fee, fee, payment_status || 'Pending', payment_method || null, payment_details || null, appointment_date]
        );
        const billId = billResult.insertId;

        // Create bill item
        await connection.query(
            'INSERT INTO bill_items (bill_id, item_name, amount, quantity) VALUES (?, ?, ?, ?)',
            [billId, 'Doctor Consultation Charge', fee, 1]
        );

        // Record payment transaction if Paid
        if (payment_status === 'Paid') {
            await connection.query(
                'INSERT INTO payments (bill_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
                [billId, fee, payment_method, payment_details || '']
            );
        }

        await connection.commit();
        res.status(201).json({
            message: 'Appointment booked successfully.',
            appointmentId,
            token_number: token,
            billId,
            shared_records_count: sharedCount
        });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to book appointment.' });
    } finally {
        connection.release();
    }
});

// 9. Get Lab Slots Catalog
router.get('/lab-slots', async (req, res) => {
    try {
        const [labTests] = await pool.query('SELECT * FROM lab_tests');
        
        // Mocking available slots for diagnostic services (available slots can be auto-generated for the next 7 days)
        // A college student would write a simple generator for the frontend or query database table if configured.
        // We will seed / mock availability of slots. To keep it aligned with original:
        // We return the tests and a list of simulated slots.
        const mockSlots = [];
        const operators = ['Mark Taylor', 'Pooja Sharma', 'Arjun Verma'];
        const dates = [0, 1, 2, 3, 4].map(days => {
            const d = new Date();
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        });
        
        let idCounter = 1;
        labTests.forEach(test => {
            dates.forEach((date, dIdx) => {
                mockSlots.push({
                    id: idCounter++,
                    lab_test_id: test.id,
                    date,
                    time_slot: '09:00 AM - 10:00 AM',
                    operator_name: operators[0],
                    status: 'Available'
                });
                mockSlots.push({
                    id: idCounter++,
                    lab_test_id: test.id,
                    date,
                    time_slot: '11:00 AM - 12:00 PM',
                    operator_name: operators[1],
                    status: 'Available'
                });
            });
        });
        
        res.json({ lab_tests: labTests, slots: mockSlots });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch lab slots.' });
    }
});

// 10. Book Lab Test
router.post('/book-lab', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { lab_test_id, date, time_slot, operator_name, payment_status, payment_method, payment_details } = req.body;

        if (!lab_test_id || !date || !time_slot) {
            return res.status(400).json({ error: 'Lab test details, date, and slot are required.' });
        }

        const [patients] = await connection.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        const [tests] = await connection.query('SELECT test_name, cost FROM lab_tests WHERE id = ?', [lab_test_id]);
        if (tests.length === 0) return res.status(404).json({ error: 'Lab test not found.' });
        const { test_name, cost } = tests[0];

        // Create Lab Request
        const [requestResult] = await connection.query(
            'INSERT INTO lab_requests (patient_id, lab_test_id, status, notes, date, time_slot, operator_name, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [patientId, lab_test_id, 'Scheduled', `Self booked slot. Operator: ${operator_name || 'Mark Taylor'}`, date, time_slot, operator_name || 'Mark Taylor', new Date().toISOString().split('T')[0]]
        );
        const requestId = requestResult.insertId;

        // Generate Bill
        const [billResult] = await connection.query(
            'INSERT INTO bills (patient_id, total_amount, net_amount, status, payment_method, payment_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [patientId, cost, cost, payment_status || 'Pending', payment_method || null, payment_details || null, new Date().toISOString().split('T')[0]]
        );
        const billId = billResult.insertId;

        // Bill Item
        await connection.query(
            'INSERT INTO bill_items (bill_id, item_name, amount, quantity) VALUES (?, ?, ?, ?)',
            [billId, `Lab diagnostics: ${test_name}`, cost, 1]
        );

        // Record payment
        if (payment_status === 'Paid') {
            await connection.query(
                'INSERT INTO payments (bill_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
                [billId, cost, payment_method, payment_details || '']
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Laboratory test slot booked successfully.', requestId, billId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to book lab slot.' });
    } finally {
        connection.release();
    }
});

// 11. Order Medicines (Pharmacy Cart Checkout)
router.post('/order-medicines', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { cart, payment_method, payment_details, discount, tax, total_amount, net_amount } = req.body;

        if (!cart || cart.length === 0) {
            return res.status(400).json({ error: 'Shopping cart is empty.' });
        }

        const [patients] = await connection.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        // Validate stock and deduct inventory
        for (const item of cart) {
            const [medicines] = await connection.query('SELECT name, quantity FROM medicines WHERE id = ? FOR UPDATE', [item.medicine_id]);
            if (medicines.length === 0) {
                throw new Error(`Medicine ${item.name} not found.`);
            }
            const med = medicines[0];
            if (med.quantity < item.qty) {
                throw new Error(`Insufficient stock for ${med.name}. Available: ${med.quantity}, Requested: ${item.qty}`);
            }

            // Deduct stock
            await connection.query('UPDATE medicines SET quantity = quantity - ? WHERE id = ?', [item.qty, item.medicine_id]);

            // Record transaction
            await connection.query(
                'INSERT INTO inventory_transactions (medicine_id, transaction_type, quantity, remarks) VALUES (?, ?, ?, ?)',
                [item.medicine_id, 'Stock Out', item.qty, `Patient Online Purchase - Sale Checkout`]
            );
        }

        // Insert into medicine_sales
        const [saleResult] = await connection.query(
            'INSERT INTO medicine_sales (patient_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [patientId, total_amount, discount || 0.00, tax || 0.00, net_amount, 'Paid', payment_method, payment_details || null, new Date().toISOString().split('T')[0]]
        );
        const saleId = saleResult.insertId;

        // Insert sale items
        for (const item of cart) {
            await connection.query(
                'INSERT INTO medicine_sale_items (medicine_sale_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [saleId, item.medicine_id, item.qty, item.price]
            );
        }

        // Record Payment
        await connection.query(
            'INSERT INTO payments (medicine_sale_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
            [saleId, net_amount, payment_method, payment_details || '']
        );

        await connection.commit();
        res.status(201).json({ message: 'Pharmacy order processed successfully!', saleId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to place order.' });
    } finally {
        connection.release();
    }
});

// 12. Retrieve Active Dashboard Logs (Consolidated data)
router.get('/dashboard-data', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not registered.' });
        const patientId = patients[0].id;

        // Appointments list (with Doctor name)
        const [appointments] = await pool.query(
            'SELECT a.*, u.full_name as doctor_name FROM appointments a JOIN doctors d ON a.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC',
            [patientId]
        );

        // Medical Records list (with Doctor name & specialization)
        const [records] = await pool.query(
            'SELECT mr.*, u.full_name as doctor_name, d.specialization FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE mr.patient_id = ? ORDER BY mr.created_at DESC',
            [patientId]
        );

        // Prescriptions items mapped
        const recordIds = records.map(r => r.id);
        let prescriptions = [];
        let prescItems = [];
        if (recordIds.length > 0) {
            [prescriptions] = await pool.query('SELECT * FROM prescriptions WHERE medical_record_id IN (?)', [recordIds]);
            const prescIds = prescriptions.map(p => p.id);
            if (prescIds.length > 0) {
                [prescItems] = await pool.query(
                    'SELECT pi.*, m.name as medicine_name FROM prescription_items pi JOIN medicines m ON pi.medicine_id = m.id WHERE pi.prescription_id IN (?)',
                    [prescIds]
                );
            }
        }

        // Lab requests and reports
        const [labRequests] = await pool.query(
            'SELECT lr.*, lt.test_name, lt.cost FROM lab_requests lr JOIN lab_tests lt ON lr.lab_test_id = lt.id WHERE lr.patient_id = ? ORDER BY lr.requested_at DESC',
            [patientId]
        );

        // Bills/Invoices
        const [bills] = await pool.query(
            'SELECT * FROM bills WHERE patient_id = ? ORDER BY created_at DESC',
            [patientId]
        );

        res.json({
            appointments,
            medical_records: records.map(r => {
                const presc = prescriptions.find(p => p.medical_record_id === r.id);
                return {
                    ...r,
                    prescription: presc ? {
                        id: presc.id,
                        instructions: presc.instructions,
                        items: prescItems.filter(i => i.prescription_id === presc.id)
                    } : null
                };
            }),
            lab_requests: labRequests,
            bills
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve dashboard data.' });
    }
});

// 13. Pay Bill Online
router.post('/bills/:id/pay', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { payment_method, payment_details } = req.body;
        const billId = req.params.id;

        const [patients] = await connection.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        const [bills] = await connection.query('SELECT net_amount, status FROM bills WHERE id = ? AND patient_id = ?', [billId, patientId]);
        if (bills.length === 0) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        
        if (bills[0].status === 'Paid') {
            return res.status(400).json({ error: 'Invoice is already paid.' });
        }

        const netAmount = bills[0].net_amount;

        // Update bill status
        await connection.query('UPDATE bills SET status = "Paid", payment_method = ?, payment_details = ? WHERE id = ?', [payment_method, payment_details || 'Online Pay', billId]);

        // Insert into payments
        await connection.query(
            'INSERT INTO payments (bill_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
            [billId, netAmount, payment_method, payment_details || '']
        );

        await connection.commit();
        res.json({ success: true, message: 'Payment processed successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to process payment.' });
    } finally {
        connection.release();
    }
});

// 14. Confirm Proposed Followup appointment
router.post('/appointments/:id/confirm-followup', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        const [appointments] = await pool.query('SELECT status FROM appointments WHERE id = ? AND patient_id = ?', [req.params.id, patientId]);
        if (appointments.length === 0) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        await pool.query('UPDATE appointments SET status = "Scheduled" WHERE id = ?', [req.params.id]);
        res.json({ message: 'Follow-up appointment confirmed and scheduled.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to confirm follow-up.' });
    }
});

// 15. Chat: Get Contacts list (Doctors consulted)
router.get('/chat-contacts', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        const patientId = patients[0].id;

        // Find doctors patient has appointments with
        const [doctors] = await pool.query(
            'SELECT DISTINCT d.id as doctor_id, u.id as user_id, u.full_name, d.specialization FROM appointments a JOIN doctors d ON a.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE a.patient_id = ?',
            [patientId]
        );
        res.json(doctors);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load chat contacts.' });
    }
});

// 16. Chat: Load Message history
router.get('/chat/:receiverId', async (req, res) => {
    try {
        const [messages] = await pool.query(
            'SELECT * FROM chat_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC',
            [req.user.id, req.params.receiverId, req.params.receiverId, req.user.id]
        );
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load messages.' });
    }
});

// 17. Chat: Send Message
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
        res.status(201).json({ message: 'Message sent.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// 18. Medical Records Portfolio: Fetch Patient's Documents (Categorized)
router.get('/documents', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not registered.' });
        const patientId = patients[0].id;

        // Fetch documents from patient_documents table
        const [docs] = await pool.query(
            'SELECT * FROM patient_documents WHERE patient_id = ? ORDER BY document_date DESC',
            [patientId]
        );

        // Also fetch completed hospital lab tests
        const [labs] = await pool.query(
            `SELECT lr.id, lr.requested_at as document_date, lt.test_name as title, 'Report' as category, 
                    'Lab Test Report' as document_type, 'Lab Generated' as source, lr.operator_name as doctor_name,
                    'Sunrise Diagnostic Labs' as facility_name, lr.report_url as file_url, lr.notes
             FROM lab_requests lr
             JOIN lab_tests lt ON lr.lab_test_id = lt.id
             WHERE lr.patient_id = ? AND lr.status = 'Completed'`,
            [patientId]
        );

        // Also fetch doctor-generated medical records / prescriptions
        const [consultations] = await pool.query(
            `SELECT mr.id, mr.created_at as document_date, CONCAT('Prescription - ', mr.diagnosis) as title, 
                    'Prescription' as category, 'Doctor Issued Prescription' as document_type, 
                    'Doctor Generated' as source, u.full_name as doctor_name, 'Sunrise Multi-Speciality Hospital' as facility_name,
                    CONCAT('rx_', mr.id, '.pdf') as file_url, mr.clinical_notes as notes
             FROM medical_records mr
             JOIN doctors d ON mr.doctor_id = d.id
             JOIN users u ON d.user_id = u.id
             WHERE mr.patient_id = ?`,
            [patientId]
        );

        const reports = docs.filter(d => d.category === 'Report');
        const prescriptions = docs.filter(d => d.category === 'Prescription' || d.category === 'Document');

        res.json({
            all_documents: docs,
            reports,
            prescriptions,
            hospital_labs: labs,
            consultation_records: consultations
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve patient medical documents.' });
    }
});

// 19. Medical Records Portfolio: Upload / Add New Document
router.post('/documents/upload', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not registered.' });
        const patientId = patients[0].id;

        const { title, category, document_type, doctor_name, facility_name, document_date, file_url, notes } = req.body;

        if (!title || !category || !document_type || !document_date) {
            return res.status(400).json({ error: 'Title, category, document type, and date are required.' });
        }

        const [result] = await pool.query(
            `INSERT INTO patient_documents 
             (patient_id, title, category, document_type, source, doctor_name, facility_name, document_date, file_url, notes) 
             VALUES (?, ?, ?, ?, 'Patient Upload', ?, ?, ?, ?, ?)`,
            [patientId, title, category, document_type, doctor_name || null, facility_name || null, document_date, file_url || null, notes || null]
        );

        res.status(201).json({
            message: 'Document added to medical records portfolio successfully.',
            document_id: result.insertId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save document.' });
    }
});

// 20. Retrieve Records Shared for a Specific Appointment (Patient Verification)
router.get('/appointments/:id/shared-records', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not registered.' });
        const patientId = patients[0].id;

        const [records] = await pool.query(
            `SELECT asr.*, pd.title, pd.document_type, pd.document_date, pd.source, pd.doctor_name, pd.facility_name, pd.file_url, pd.notes
             FROM appointment_shared_records asr
             JOIN patient_documents pd ON asr.document_id = pd.id
             WHERE asr.appointment_id = ? AND asr.patient_id = ?`,
            [req.params.id, patientId]
        );

        res.json(records);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve shared records.' });
    }
});

// 21. Frequently Visited Doctors for Returning Patient
router.get('/frequently-visited-doctors', async (req, res) => {
    try {
        const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.user.id]);
        if (patients.length === 0) return res.status(404).json({ error: 'Patient not registered.' });
        const patientId = patients[0].id;

        const [results] = await pool.query(`
            SELECT 
                d.id, d.user_id, d.department_id, d.fee, d.specialization, d.room_no,
                d.availability, d.available_days, d.start_time, d.end_time, d.slot_duration,
                u.full_name, dept.name as department_name,
                COUNT(a.id) as visit_count,
                MAX(a.appointment_date) as last_visited_date
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            WHERE a.patient_id = ? AND a.status = 'Completed'
            GROUP BY d.id, d.user_id, d.department_id, d.fee, d.specialization, d.room_no,
                     d.availability, d.available_days, d.start_time, d.end_time, d.slot_duration,
                     u.full_name, dept.name
            ORDER BY visit_count DESC, last_visited_date DESC, d.id ASC
        `, [patientId]);

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve frequently visited doctors.' });
    }
});

export default router;


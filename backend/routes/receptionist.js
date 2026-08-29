import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('Receptionist'));

// 1. Get Patients List (for booking dropdowns)
router.get('/patients', async (req, res) => {
    try {
        const [patients] = await pool.query(
            'SELECT p.id, p.phone, u.full_name, u.email FROM patients p JOIN users u ON p.user_id = u.id'
        );
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve patients.' });
    }
});

// 2. Get Doctors List
router.get('/doctors', async (req, res) => {
    try {
        const [doctors] = await pool.query(
            'SELECT d.id, d.fee, d.department_id, u.full_name, dept.name as department_name FROM doctors d JOIN users u ON d.user_id = u.id JOIN departments dept ON d.department_id = dept.id'
        );
        res.json(doctors);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve doctors.' });
    }
});

// 3. Register Patient from reception
router.post('/register-patient', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { full_name, email, password, phone, dob, gender, blood_group, emergency_contact, address } = req.body;

        if (!full_name || !email || !phone) {
            return res.status(400).json({ error: 'Full Name, Email, and Phone number are required fields.' });
        }

        // Check user existence
        const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        // Check phone existence
        const [existingPhone] = await connection.query('SELECT id FROM patients WHERE phone = ?', [phone]);
        if (existingPhone.length > 0) {
            return res.status(400).json({ error: 'Phone number is already registered.' });
        }

        // Default password if not specified
        const password_hash = await bcrypt.hash(password || 'patient123', 10);

        // Insert user
        const [userResult] = await connection.query(
            'INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, 7)',
            [full_name, email, password_hash]
        );
        const userId = userResult.insertId;

        // Insert patient
        await connection.query(
            'INSERT INTO patients (user_id, phone, dob, gender, blood_group, emergency_contact, address, incomplete) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)',
            [userId, phone, dob || null, gender || null, blood_group || null, emergency_contact || null, address || null]
        );

        await connection.commit();
        res.status(201).json({ message: 'Patient registered successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to register patient.' });
    } finally {
        connection.release();
    }
});

// 4. Book Appointment from reception desk
router.post('/book-appointment', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { patient_id, doctor_id, appointment_date, appointment_time, reason, payment_status, payment_method, payment_details } = req.body;

        if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'Patient ID, Doctor ID, Date, and Time Slot are required.' });
        }

        // Get doctor details
        const [doctors] = await connection.query('SELECT department_id, fee FROM doctors WHERE id = ?', [doctor_id]);
        if (doctors.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
        const { department_id, fee } = doctors[0];

        // Increment token counter
        const [existing] = await connection.query('SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?', [doctor_id, appointment_date]);
        const token = existing[0].count + 1;

        // Create appointment
        const [aptResult] = await connection.query(
            'INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [patient_id, doctor_id, department_id, appointment_date, appointment_time, token, 'Scheduled', reason || 'OPD checkup']
        );
        const appointmentId = aptResult.insertId;

        // Generate Bill
        const [billResult] = await connection.query(
            'INSERT INTO bills (patient_id, appointment_id, total_amount, net_amount, status, payment_method, payment_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [patient_id, appointmentId, fee, fee, payment_status || 'Pending', payment_method || null, payment_details || null, appointment_date]
        );
        const billId = billResult.insertId;

        // Bill Item
        await connection.query(
            'INSERT INTO bill_items (bill_id, item_name, amount, quantity) VALUES (?, ?, ?, ?)',
            [billId, 'Doctor Consultation Charge', fee, 1]
        );

        // Payment record
        if (payment_status === 'Paid') {
            await connection.query(
                'INSERT INTO payments (bill_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
                [billId, fee, payment_method, payment_details || '']
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Appointment booked successfully.', appointmentId, token_number: token, billId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to book appointment.' });
    } finally {
        connection.release();
    }
});

// 5. Get Appointments journal
router.get('/appointments', async (req, res) => {
    try {
        const [appointments] = await pool.query(
            `SELECT a.*, pu.full_name as patient_name, du.full_name as doctor_name, dept.name as department_name 
             FROM appointments a 
             JOIN patients p ON a.patient_id = p.id 
             JOIN users pu ON p.user_id = pu.id 
             JOIN doctors d ON a.doctor_id = d.id 
             JOIN users du ON d.user_id = du.id 
             JOIN departments dept ON a.department_id = dept.id
             ORDER BY a.appointment_date DESC`
        );
        res.json(appointments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch appointments log.' });
    }
});

export default router;

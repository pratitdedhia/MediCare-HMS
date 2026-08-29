import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('Admin'));

// 1. Get Staff Accounts List (roles 1 to 6)
router.get('/users', async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.full_name, u.email, r.name as role, u.created_at 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.role_id < 7 
             ORDER BY u.id ASC`
        );
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve staff accounts.' });
    }
});

// 2. Create Staff Account (with doctors extension support)
router.post('/users', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { full_name, email, password, role_name, department_id, specialization, fee, room_no } = req.body;

        if (!full_name || !email || !password || !role_name) {
            return res.status(400).json({ error: 'Full name, email, password, and role name are required.' });
        }

        // Check if email already exists
        const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        // Get Role ID
        const [roles] = await connection.query('SELECT id FROM roles WHERE name = ?', [role_name]);
        if (roles.length === 0) return res.status(404).json({ error: 'Selected role does not exist.' });
        const roleId = roles[0].id;

        // Hash Password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert User
        const [userResult] = await connection.query(
            'INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
            [full_name, email, password_hash, roleId]
        );
        const userId = userResult.insertId;

        // If Doctor, insert into doctors table
        if (role_name === 'Doctor') {
            if (!department_id || !specialization || !fee) {
                throw new Error('Doctor accounts require Department, Specialization, and Consultation fee fields.');
            }
            await connection.query(
                `INSERT INTO doctors (user_id, department_id, specialization, fee, room_no, availability, available_days) 
                 VALUES (?, ?, ?, ?, ?, "Mon-Fri: 09:00 AM - 04:00 PM", '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]')`,
                [userId, department_id, specialization, fee, room_no || 'Room 101']
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Staff account provisioned successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to create staff account.' });
    } finally {
        connection.release();
    }
});

// 3. Get System Analytics
router.get('/analytics', async (req, res) => {
    try {
        // Total Patients
        const [patients] = await pool.query('SELECT COUNT(*) as count FROM patients');
        
        // Total Appointments
        const [appointments] = await pool.query('SELECT COUNT(*) as count FROM appointments');
        
        // Total OPD Earnings
        const [opdRevenue] = await pool.query('SELECT SUM(net_amount) as total FROM bills WHERE status = "Paid"');
        
        // Total Pharmacy Earnings
        const [pharmacyRevenue] = await pool.query('SELECT SUM(net_amount) as total FROM medicine_sales WHERE status = "Paid"');
        
        // Out of Stock Medicines Count
        const [lowStock] = await pool.query('SELECT COUNT(*) as count FROM medicines WHERE quantity <= 5');

        res.json({
            patients_count: patients[0].count,
            appointments_count: appointments[0].count,
            earnings_opd: opdRevenue[0].total || 0,
            earnings_pharmacy: pharmacyRevenue[0].total || 0,
            low_stock_count: lowStock[0].count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve analytics.' });
    }
});

// 4. Retrieve Departments (for dropdown selection)
router.get('/departments', async (req, res) => {
    try {
        const [departments] = await pool.query('SELECT * FROM departments');
        res.json(departments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch departments.' });
    }
});

// 5. Database Manager: Export table rows
router.get('/database/export/:table', async (req, res) => {
    try {
        const allowedTables = [
            'users', 'roles', 'departments', 'doctors', 'patients',
            'appointments', 'medical_records', 'prescriptions', 'prescription_items',
            'lab_tests', 'lab_requests', 'lab_reports', 'medicines',
            'medicine_sales', 'medicine_sale_items', 'inventory_transactions',
            'bills', 'bill_items', 'payments', 'doctor_availability',
            'chat_messages', 'insurance_policies', 'patient_illnesses', 'announcements'
        ];
        
        const table = req.params.table;
        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Invalid table name requested.' });
        }

        const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to export table data.' });
    }
});

export default router;

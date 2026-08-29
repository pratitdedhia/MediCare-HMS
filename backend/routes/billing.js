import express from 'express';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('Billing Staff'));

// 1. Get Bills List (with patient name & phone)
router.get('/bills', async (req, res) => {
    try {
        const [bills] = await pool.query(
            `SELECT b.*, u.full_name as patient_name, p.phone as patient_phone 
             FROM bills b 
             JOIN patients p ON b.patient_id = p.id 
             JOIN users u ON p.user_id = u.id 
             ORDER BY b.created_at DESC`
        );
        res.json(bills);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve bills ledger.' });
    }
});

// 2. Get Patients list
router.get('/patients', async (req, res) => {
    try {
        const [patients] = await pool.query(
            'SELECT p.id, p.phone, u.full_name FROM patients p JOIN users u ON p.user_id = u.id'
        );
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve patients.' });
    }
});

// 3. Create Manual Invoice
router.post('/bill', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { patient_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, particulars } = req.body;

        if (!patient_id || !total_amount || !net_amount || !particulars) {
            return res.status(400).json({ error: 'Patient ID, total amount, net amount, and particulars text are required.' });
        }

        const dateStr = new Date().toISOString().split('T')[0];
        
        // Create bill
        const [billResult] = await connection.query(
            'INSERT INTO bills (patient_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [patient_id, total_amount, discount || 0.00, tax || 0.00, net_amount, status || 'Pending', payment_method || null, payment_details || null, dateStr]
        );
        const billId = billResult.insertId;

        // Insert bill items
        await connection.query(
            'INSERT INTO bill_items (bill_id, item_name, amount, quantity) VALUES (?, ?, ?, 1)',
            [billId, particulars, total_amount]
        );

        // Record payment
        if (status === 'Paid') {
            await connection.query(
                'INSERT INTO payments (bill_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
                [billId, net_amount, payment_method || 'Cash', payment_details || '']
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Invoice generated successfully.', billId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to generate invoice.' });
    } finally {
        connection.release();
    }
});

// 4. Record Offline Cash/Card Payment on Invoice
router.post('/bills/:id/pay', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { payment_method, payment_details } = req.body;
        const billId = req.params.id;

        const [bills] = await connection.query('SELECT net_amount, status FROM bills WHERE id = ?', [billId]);
        if (bills.length === 0) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        if (bills[0].status === 'Paid') {
            return res.status(400).json({ error: 'Invoice is already marked as Paid.' });
        }

        const netAmount = bills[0].net_amount;

        // Update bill status
        await connection.query(
            'UPDATE bills SET status = "Paid", payment_method = ?, payment_details = ? WHERE id = ?',
            [payment_method || 'Cash', payment_details || 'Counter Payment', billId]
        );

        // Insert into payments
        await connection.query(
            'INSERT INTO payments (bill_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
            [billId, netAmount, payment_method || 'Cash', payment_details || '']
        );

        await connection.commit();
        res.json({ message: 'Payment recorded and status completed.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to record payment.' });
    } finally {
        connection.release();
    }
});

export default router;

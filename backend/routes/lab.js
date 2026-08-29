import express from 'express';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('Laboratory Staff'));

// 1. Get Pending & Completed Lab Requests
router.get('/requests', async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT lr.*, u.full_name as patient_name, lt.test_name, lr_rep.notes as report_notes, lr_rep.report_url as report_pdf 
             FROM lab_requests lr 
             JOIN patients p ON lr.patient_id = p.id 
             JOIN users u ON p.user_id = u.id 
             JOIN lab_tests lt ON lr.lab_test_id = lt.id
             LEFT JOIN lab_reports lr_rep ON lr.id = lr_rep.lab_request_id
             ORDER BY lr.requested_at DESC`
        );
        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch lab requests.' });
    }
});

// 2. Upload/Complete Lab Test (saves report details and operator signature)
router.post('/upload-report', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { request_id, operator_name, notes, report_url } = req.body;

        if (!request_id || !operator_name || !notes) {
            return res.status(400).json({ error: 'Request ID, Operator name, and Findings notes are required.' });
        }

        // Check request existence
        const [requests] = await connection.query('SELECT id FROM lab_requests WHERE id = ?', [request_id]);
        if (requests.length === 0) {
            return res.status(404).json({ error: 'Lab request not found.' });
        }

        // Update lab request status
        const dateStr = new Date().toISOString().split('T')[0];
        await connection.query(
            `UPDATE lab_requests 
             SET status = "Completed", operator_name = ?, notes = ?, report_url = ?, date = ? 
             WHERE id = ?`,
            [operator_name, notes, report_url || 'Report_Completed.pdf', dateStr, request_id]
        );

        // Delete any existing report to avoid duplicate keys
        await connection.query('DELETE FROM lab_reports WHERE lab_request_id = ?', [request_id]);

        // Insert into lab_reports
        await connection.query(
            'INSERT INTO lab_reports (lab_request_id, report_url, notes) VALUES (?, ?, ?)',
            [request_id, report_url || 'Report_Completed.pdf', notes]
        );

        await connection.commit();
        res.json({ message: 'Lab report uploaded and status completed successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to upload lab report.' });
    } finally {
        connection.release();
    }
});

export default router;

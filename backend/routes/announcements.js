import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// 1. Get Announcements
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT a.*, u.full_name as author_name 
             FROM announcements a 
             JOIN users u ON a.created_by = u.id 
             ORDER BY a.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve announcements.' });
    }
});

// 2. Create Announcement (restricted to Admin, Doctor, or Receptionist roles)
router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;
        const allowedRoles = ['Admin', 'Doctor', 'Receptionist'];
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Unauthorized to post announcements.' });
        }

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }

        await pool.query(
            'INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)',
            [title, content, req.user.id]
        );
        res.status(201).json({ message: 'Announcement published successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to publish announcement.' });
    }
});

export default router;

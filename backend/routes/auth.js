import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

// 1. Standard Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Find user and join role
        const [users] = await pool.query(
            'SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];
        
        // If password is empty (e.g. quick OTP user has no password initially)
        if (!user.password_hash && password === '') {
            // Allow login (or handle as blank password)
        } else {
            // Match password
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }
        }

        // Sign JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
            process.env.JWT_SECRET || 'change_this_secret_key_123_456_789',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 2. Patient Register
router.post('/register', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            full_name,
            email,
            password,
            phone,
            dob,
            gender,
            blood_group,
            emergency_contact,
            address
        } = req.body;

        if (!full_name || !email || !password || !phone) {
            return res.status(400).json({ error: 'Full name, email, password, and phone are required fields.' });
        }

        // Check if user exists
        const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        // Check if phone exists
        const [existingPhone] = await connection.query('SELECT id FROM patients WHERE phone = ?', [phone]);
        if (existingPhone.length > 0) {
            return res.status(400).json({ error: 'Phone number is already registered.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insert into users (role_id = 7 is Patient)
        const [userResult] = await connection.query(
            'INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, 7)',
            [full_name, email, password_hash]
        );
        const userId = userResult.insertId;

        // Insert into patients
        await connection.query(
            'INSERT INTO patients (user_id, phone, dob, gender, blood_group, emergency_contact, address, incomplete) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, phone, dob || null, gender || null, blood_group || null, emergency_contact || null, address || null, false]
        );

        await connection.commit();
        res.status(201).json({ message: 'Patient registered successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Internal server error during registration.' });
    } finally {
        connection.release();
    }
});

// 3. Send OTP (Simulated)
router.post('/send-otp', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }
    const cleanPhone = phone.replace(/[\s-]/g, '');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    res.json({ success: true, phone: cleanPhone, otp });
});

// 4. Verify OTP (Handles both existing login and on-the-fly registration)
router.post('/verify-otp', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }
        const cleanPhone = phone.trim();

        // Check if patient exists
        const [patients] = await connection.query('SELECT p.*, u.full_name, u.email FROM patients p JOIN users u ON p.user_id = u.id WHERE p.phone = ?', [cleanPhone]);
        
        let user;
        if (patients.length > 0) {
            const patient = patients[0];
            user = {
                id: patient.user_id,
                full_name: patient.full_name,
                email: patient.email,
                role: 'Patient'
            };
        } else {
            // Register on the fly
            const shortPhone = cleanPhone.slice(-10);
            const full_name = `Quick Patient (${shortPhone})`;
            const email = `quick_${cleanPhone.replace('+', '').replace(/[\s-]/g, '')}@medicare.com`;
            
            // Insert user with role_id = 7 (Patient)
            const [userResult] = await connection.query(
                'INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, 7)',
                [full_name, email, '']
            );
            const userId = userResult.insertId;

            // Insert patient with incomplete = true
            await connection.query(
                'INSERT INTO patients (user_id, phone, incomplete) VALUES (?, ?, TRUE)',
                [userId, cleanPhone]
            );

            user = {
                id: userId,
                full_name,
                email,
                role: 'Patient'
            };
        }

        await connection.commit();

        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'Patient', full_name: user.full_name },
            process.env.JWT_SECRET || 'change_this_secret_key_123_456_789',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: 'Patient'
            }
        });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'OTP verification failed.' });
    } finally {
        connection.release();
    }
});

export default router;

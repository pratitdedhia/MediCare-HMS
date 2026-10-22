import express from 'express';
import pool from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('Pharmacist'));

// 1. Get Medicines Catalog
router.get('/medicines', async (req, res) => {
    try {
        const [medicines] = await pool.query('SELECT * FROM medicines ORDER BY name ASC');
        res.json(medicines);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve medicine inventory.' });
    }
});

// 2. Add Quantity Stock
router.post('/add-stock', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { medicine_id, quantity, remarks } = req.body;

        if (!medicine_id || !quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Valid medicine ID and positive quantity are required.' });
        }

        // Check medicine existence
        const [medicines] = await connection.query('SELECT name FROM medicines WHERE id = ?', [medicine_id]);
        if (medicines.length === 0) {
            return res.status(404).json({ error: 'Medicine not found.' });
        }

        // Add quantity
        await connection.query('UPDATE medicines SET quantity = quantity + ? WHERE id = ?', [quantity, medicine_id]);

        // Record inventory transaction
        await connection.query(
            'INSERT INTO inventory_transactions (medicine_id, transaction_type, quantity, remarks) VALUES (?, "Stock In", ?, ?)',
            [medicine_id, quantity, remarks || 'Pharmacist manual stock replenishment']
        );

        await connection.commit();
        res.json({ message: 'Stock restocked successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to update stock.' });
    } finally {
        connection.release();
    }
});

// 3. Create New Medicine
router.post('/medicine', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { name, category, brand, unit_price, quantity } = req.body;

        if (!name || !category || !unit_price) {
            return res.status(400).json({ error: 'Name, Category, and Unit Price are required.' });
        }

        // Check duplication
        const [existing] = await connection.query('SELECT id FROM medicines WHERE name = ?', [name]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Medicine name already exists in inventory.' });
        }

        const qty = quantity || 0;
        const [result] = await connection.query(
            'INSERT INTO medicines (name, category, brand, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
            [name, category, brand || '', unit_price, qty]
        );
        const medId = result.insertId;

        // If initialized with quantity > 0, record inventory transaction
        if (qty > 0) {
            await connection.query(
                'INSERT INTO inventory_transactions (medicine_id, transaction_type, quantity, remarks) VALUES (?, "Stock In", ?, ?)',
                [medId, qty, 'Initial stock entry']
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'New medicine added to inventory successfully.', medicineId: medId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to add new medicine.' });
    } finally {
        connection.release();
    }
});

// 4. Get Sales Ledger (Invoices)
router.get('/sales', async (req, res) => {
    try {
        const [sales] = await pool.query(
            `SELECT ms.*, u.full_name as patient_name 
             FROM medicine_sales ms 
             LEFT JOIN patients p ON ms.patient_id = p.id 
             LEFT JOIN users u ON p.user_id = u.id 
             ORDER BY ms.created_at DESC`
        );
        
        const saleIds = sales.map(s => s.id);
        let saleItems = [];
        if (saleIds.length > 0) {
            [saleItems] = await pool.query(
                `SELECT msi.*, m.name as medicine_name 
                 FROM medicine_sale_items msi 
                 JOIN medicines m ON msi.medicine_id = m.id 
                 WHERE msi.medicine_sale_id IN (?)`,
                [saleIds]
            );
        }

        res.json(sales.map(s => ({
            ...s,
            items: saleItems.filter(i => i.medicine_sale_id === s.id)
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve sales logs.' });
    }
});

// 5. Record Offline Sale
router.post('/record-sale', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { patient_id, cart, discount, tax, total_amount, net_amount, payment_method, payment_details } = req.body;

        if (!cart || cart.length === 0) {
            return res.status(400).json({ error: 'Cart items are required.' });
        }

        // Deduct inventory
        for (const item of cart) {
            const [medicines] = await connection.query('SELECT name, quantity FROM medicines WHERE id = ? FOR UPDATE', [item.medicine_id]);
            if (medicines.length === 0) throw new Error(`Medicine ${item.name} not found.`);
            const med = medicines[0];
            if (med.quantity < item.qty) {
                throw new Error(`Insufficient stock for ${med.name}. Available: ${med.quantity}, Requested: ${item.qty}`);
            }

            await connection.query('UPDATE medicines SET quantity = quantity - ? WHERE id = ?', [item.qty, item.medicine_id]);
            await connection.query(
                'INSERT INTO inventory_transactions (medicine_id, transaction_type, quantity, remarks) VALUES (?, "Stock Out", ?, ?)',
                [item.medicine_id, 'Stock Out', item.qty, 'Pharmacist direct retail counter sale']
            );
        }

        // Create Sale
        const [saleResult] = await connection.query(
            'INSERT INTO medicine_sales (patient_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at) VALUES (?, ?, ?, ?, ?, "Paid", ?, ?, ?)',
            [patient_id || null, total_amount, discount || 0.00, tax || 0.00, net_amount, payment_method || 'Cash', payment_details || 'Offline Sale', new Date().toISOString().split('T')[0]]
        );
        const saleId = saleResult.insertId;

        // Insert items
        for (const item of cart) {
            await connection.query(
                'INSERT INTO medicine_sale_items (medicine_sale_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [saleId, item.medicine_id, item.qty, item.price]
            );
        }

        // Record payment
        await connection.query(
            'INSERT INTO payments (medicine_sale_id, amount, payment_method, transaction_reference) VALUES (?, ?, ?, ?)',
            [saleId, net_amount, payment_method || 'Cash', payment_details || '']
        );

        await connection.commit();
        res.status(201).json({ message: 'Retail sale checkout recorded successfully.', saleId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message || 'Failed to record sale.' });
    } finally {
        connection.release();
    }
});

export default router;

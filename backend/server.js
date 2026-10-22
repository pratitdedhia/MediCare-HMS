import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patient.js';
import doctorRoutes from './routes/doctor.js';
import receptionistRoutes from './routes/receptionist.js';
import labRoutes from './routes/lab.js';
import pharmacyRoutes from './routes/pharmacy.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import announcementsRoutes from './routes/announcements.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes registration
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/receptionist', receptionistRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'MediCare HMS Backend REST API is running' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Start Server
app.listen(PORT, '0.0.5.0' === '127.0.0.1' ? '127.0.0.1' : '0.0.0.0', () => {
    console.log(`🚀 Server started and listening on http://localhost:${PORT}`);
});

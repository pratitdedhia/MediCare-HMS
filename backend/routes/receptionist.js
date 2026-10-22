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

// Helper to parse time strings like "10:00 AM", "14:30", "11:00" to minutes
function parseTimeStringToMinutes(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
}

// 4. Book Appointment from reception desk (with walk-in support, double-booking prevention & availability check)
router.post('/book-appointment', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { 
            patient_id, doctor_id, appointment_date, appointment_time, 
            reason, consultation_type, status, payment_status, payment_method, payment_details 
        } = req.body;

        if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'Patient ID, Doctor ID, Date, and Time Slot are required.' });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (appointment_date < todayStr) {
            return res.status(400).json({ error: 'Cannot book appointments for past dates. Please select today or a future date.' });
        }

        // Get doctor details
        const [doctors] = await connection.query('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
        if (doctors.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
        const doctor = doctors[0];
        const { department_id, fee } = doctor;

        // Check availability on day of week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const aptDay = dayNames[new Date(appointment_date + 'T00:00:00').getDay()];
        let availableDays = [];
        try {
            availableDays = typeof doctor.available_days === 'string' ? JSON.parse(doctor.available_days) : (doctor.available_days || []);
        } catch (e) {
            availableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        }
        if (availableDays.length > 0 && !availableDays.includes(aptDay)) {
            return res.status(400).json({ 
                error: `Doctor does not consult on ${aptDay}s. Available days: ${availableDays.join(', ')}` 
            });
        }

        // Check doctor leave in doctor_availability table
        const [leaves] = await connection.query(
            "SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? AND type = 'Leave' AND status = 'Active'",
            [doctor_id, appointment_date]
        );
        if (leaves.length > 0) {
            return res.status(400).json({ error: 'Doctor is on scheduled leave on this date.' });
        }

        // Prevent double-booking: Check if another active appointment already occupies this slot
        const [conflicts] = await connection.query(
            "SELECT id, token_number FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled'",
            [doctor_id, appointment_date, appointment_time]
        );
        if (conflicts.length > 0) {
            return res.status(409).json({ 
                error: `Conflict: Doctor is already booked at ${appointment_time} on ${appointment_date} (Token #${conflicts[0].token_number}). Double-booking is prevented.` 
            });
        }

        // Increment token counter for this doctor on this day
        const [existing] = await connection.query(
            'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?', 
            [doctor_id, appointment_date]
        );
        const token = existing[0].count + 1;

        // Initial appointment status: supports 'Arrived' (for walk-ins checked in immediately) or 'Scheduled'
        const initialStatus = (status === 'Arrived') ? 'Arrived' : 'Scheduled';
        const typeOfConsultation = consultation_type || (status === 'Arrived' ? 'Walk-in Consultation' : 'OPD Consultation');

        // Create appointment
        const [aptResult] = await connection.query(
            'INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [patient_id, doctor_id, department_id, appointment_date, appointment_time, token, initialStatus, typeOfConsultation, reason || 'OPD checkup']
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

        // Payment record if paid
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
            status: initialStatus
        });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to book appointment.' });
    } finally {
        connection.release();
    }
});

// 5. Get Appointments journal (supports date, doctor, status, time range, and patient search filters)
router.get('/appointments', async (req, res) => {
    try {
        const { date, doctor_id, status, time, search } = req.query;

        let query = `
            SELECT a.*, pu.full_name as patient_name, pu.email as patient_email, 
                   p.phone as patient_phone, p.emergency_contact, p.blood_group,
                   du.full_name as doctor_name, d.room_no as doctor_room, d.fee as doctor_fee,
                   d.specialization as doctor_specialization, dept.name as department_name 
            FROM appointments a 
            JOIN patients p ON a.patient_id = p.id 
            JOIN users pu ON p.user_id = pu.id 
            JOIN doctors d ON a.doctor_id = d.id 
            JOIN users du ON d.user_id = du.id 
            JOIN departments dept ON a.department_id = dept.id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            query += ' AND a.appointment_date = ?';
            params.push(date);
        }
        if (doctor_id) {
            query += ' AND a.doctor_id = ?';
            params.push(doctor_id);
        }
        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (pu.full_name LIKE ? OR p.phone LIKE ? OR pu.email LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        query += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC, a.token_number ASC';

        const [appointments] = await pool.query(query, params);

        let filtered = appointments;
        if (time) {
            filtered = appointments.filter(apt => {
                const mins = parseTimeStringToMinutes(apt.appointment_time);
                if (mins === null) return true;
                if (time === 'morning') return mins < 12 * 60;
                if (time === 'afternoon') return mins >= 12 * 60 && mins < 16 * 60;
                if (time === 'evening') return mins >= 16 * 60;
                return true;
            });
        }

        res.json(filtered);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch appointments log.' });
    }
});

// 6. Get Today's Appointments (default date: today)
router.get('/today-appointments', async (req, res) => {
    try {
        const todayStr = req.query.date || new Date().toISOString().split('T')[0];
        const { doctor_id, status, time, search } = req.query;

        let query = `
            SELECT a.*, pu.full_name as patient_name, pu.email as patient_email, 
                   p.phone as patient_phone, p.emergency_contact, p.blood_group,
                   du.full_name as doctor_name, d.room_no as doctor_room, d.fee as doctor_fee,
                   d.specialization as doctor_specialization, dept.name as department_name 
            FROM appointments a 
            JOIN patients p ON a.patient_id = p.id 
            JOIN users pu ON p.user_id = pu.id 
            JOIN doctors d ON a.doctor_id = d.id 
            JOIN users du ON d.user_id = du.id 
            JOIN departments dept ON a.department_id = dept.id
            WHERE a.appointment_date = ?
        `;
        const params = [todayStr];

        if (doctor_id) {
            query += ' AND a.doctor_id = ?';
            params.push(doctor_id);
        }
        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (pu.full_name LIKE ? OR p.phone LIKE ? OR pu.email LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        query += ' ORDER BY a.appointment_time ASC, a.token_number ASC';

        const [appointments] = await pool.query(query, params);

        let filtered = appointments;
        if (time) {
            filtered = appointments.filter(apt => {
                const mins = parseTimeStringToMinutes(apt.appointment_time);
                if (mins === null) return true;
                if (time === 'morning') return mins < 12 * 60;
                if (time === 'afternoon') return mins >= 12 * 60 && mins < 16 * 60;
                if (time === 'evening') return mins >= 16 * 60;
                return true;
            });
        }

        res.json(filtered);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve today\'s appointments.' });
    }
});

// 7. Update Appointment Status (Supported: 'Scheduled', 'Arrived', 'Completed', 'Cancelled', 'Proposed')
const handleStatusUpdate = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { status } = req.body;

        const allowedStatuses = ['Scheduled', 'Arrived', 'Completed', 'Cancelled', 'Proposed'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ 
                error: `Invalid status. Supported statuses are: ${allowedStatuses.join(', ')}` 
            });
        }

        const [existing] = await pool.query('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, appointmentId]);

        res.json({ 
            success: true, 
            message: `Appointment #${appointmentId} status updated to ${status}.`,
            appointmentId: parseInt(appointmentId),
            status 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update appointment status.' });
    }
};

router.patch('/appointments/:id/status', handleStatusUpdate);
router.put('/appointments/:id/status', handleStatusUpdate);

// 8. Reschedule Appointment (with double-booking check & doctor availability verification)
router.put('/appointments/:id/reschedule', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const appointmentId = req.params.id;
        const { appointment_date, appointment_time, doctor_id, reason } = req.body;

        if (!appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'New appointment date and time slot are required.' });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (appointment_date < todayStr) {
            return res.status(400).json({ error: 'Cannot reschedule to a past date. Select today or a future date.' });
        }

        const [existing] = await connection.query('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }
        const currentApt = existing[0];
        const targetDoctorId = doctor_id || currentApt.doctor_id;

        const [doctors] = await connection.query('SELECT * FROM doctors WHERE id = ?', [targetDoctorId]);
        if (doctors.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
        const doctor = doctors[0];

        // Check availability on day of week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const aptDay = dayNames[new Date(appointment_date + 'T00:00:00').getDay()];
        let availableDays = [];
        try {
            availableDays = typeof doctor.available_days === 'string' ? JSON.parse(doctor.available_days) : (doctor.available_days || []);
        } catch (e) {
            availableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        }
        if (availableDays.length > 0 && !availableDays.includes(aptDay)) {
            return res.status(400).json({ 
                error: `Doctor is not available on ${aptDay}s. Consulting days: ${availableDays.join(', ')}` 
            });
        }

        // Check doctor leave in doctor_availability table
        const [leaves] = await connection.query(
            "SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? AND type = 'Leave' AND status = 'Active'",
            [targetDoctorId, appointment_date]
        );
        if (leaves.length > 0) {
            return res.status(400).json({ error: 'Doctor is on scheduled leave on this date.' });
        }

        // Check double-booking conflict (exclude the appointment currently being rescheduled)
        const [conflicts] = await connection.query(
            "SELECT id, token_number FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND id != ? AND status != 'Cancelled'",
            [targetDoctorId, appointment_date, appointment_time, appointmentId]
        );
        if (conflicts.length > 0) {
            return res.status(409).json({ 
                error: `Conflict: Doctor is already booked at ${appointment_time} on ${appointment_date} (Token #${conflicts[0].token_number}). Please select another slot or doctor.` 
            });
        }

        // Update appointment
        await connection.query(
            `UPDATE appointments 
             SET appointment_date = ?, appointment_time = ?, doctor_id = ?, department_id = ?, 
                 status = 'Scheduled', reason = COALESCE(?, reason) 
             WHERE id = ?`,
            [appointment_date, appointment_time, targetDoctorId, doctor.department_id, reason || null, appointmentId]
        );

        await connection.commit();
        res.json({ 
            success: true, 
            message: `Appointment #${appointmentId} successfully rescheduled to ${appointment_date} at ${appointment_time}.`,
            appointmentId: parseInt(appointmentId),
            appointment_date,
            appointment_time,
            doctor_id: targetDoctorId,
            status: 'Scheduled'
        });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to reschedule appointment.' });
    } finally {
        connection.release();
    }
});

// 9. Doctor Availability & Alternative Doctors Check (for walk-in dispatch & scheduling)
router.get('/doctor-availability', async (req, res) => {
    try {
        const { doctor_id, date, time } = req.query;
        if (!doctor_id || !date) {
            return res.status(400).json({ error: 'doctor_id and date query parameters are required.' });
        }

        const [doctors] = await pool.query(
            `SELECT d.*, u.full_name as doctor_name, dept.name as department_name 
             FROM doctors d 
             JOIN users u ON d.user_id = u.id 
             JOIN departments dept ON d.department_id = dept.id 
             WHERE d.id = ?`,
            [doctor_id]
        );
        if (doctors.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
        const doctor = doctors[0];

        // Booked appointments for this doctor on this date
        const [bookedAppointments] = await pool.query(
            `SELECT a.id, a.appointment_time, a.token_number, a.status, pu.full_name as patient_name 
             FROM appointments a 
             JOIN patients p ON a.patient_id = p.id 
             JOIN users pu ON p.user_id = pu.id 
             WHERE a.doctor_id = ? AND a.appointment_date = ? AND a.status != 'Cancelled'
             ORDER BY a.appointment_time ASC`,
            [doctor_id, date]
        );

        // Day of week check
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = dayNames[new Date(date + 'T00:00:00').getDay()];
        let availableDays = [];
        try {
            availableDays = typeof doctor.available_days === 'string' ? JSON.parse(doctor.available_days) : (doctor.available_days || []);
        } catch (e) {
            availableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        }

        const isWorkingDay = availableDays.length === 0 || availableDays.includes(dayOfWeek);

        // Leave check
        const [leaves] = await pool.query(
            "SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? AND type = 'Leave' AND status = 'Active'",
            [doctor_id, date]
        );
        const isOnLeave = leaves.length > 0;

        // Specific time slot check if provided
        let isSlotBooked = false;
        let conflictAppointment = null;
        if (time) {
            conflictAppointment = bookedAppointments.find(a => a.appointment_time === time);
            isSlotBooked = !!conflictAppointment;
        }

        const isAvailable = isWorkingDay && !isOnLeave && !isSlotBooked;
        let unavailabilityReason = null;
        if (!isWorkingDay) {
            unavailabilityReason = `${doctor.doctor_name} does not consult on ${dayOfWeek}s. (Consulting days: ${availableDays.join(', ')})`;
        } else if (isOnLeave) {
            unavailabilityReason = `${doctor.doctor_name} is on scheduled leave on ${date}.`;
        } else if (isSlotBooked) {
            unavailabilityReason = `Time slot ${time} is already booked (Token #${conflictAppointment.token_number} - ${conflictAppointment.patient_name}).`;
        }

        // If unavailable, find alternative available doctors in the same department!
        let alternativeDoctors = [];
        if (!isAvailable) {
            const [peers] = await pool.query(
                `SELECT d.*, u.full_name as doctor_name, dept.name as department_name 
                 FROM doctors d 
                 JOIN users u ON d.user_id = u.id 
                 JOIN departments dept ON d.department_id = dept.id 
                 WHERE d.department_id = ? AND d.id != ?`,
                [doctor.department_id, doctor.id]
            );

            for (const peer of peers) {
                let peerDays = [];
                try {
                    peerDays = typeof peer.available_days === 'string' ? JSON.parse(peer.available_days) : (peer.available_days || []);
                } catch (e) {
                    peerDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
                }
                const peerWorksToday = peerDays.length === 0 || peerDays.includes(dayOfWeek);
                if (!peerWorksToday) continue;

                const [peerLeaves] = await pool.query(
                    "SELECT id FROM doctor_availability WHERE doctor_id = ? AND date = ? AND type = 'Leave' AND status = 'Active'",
                    [peer.id, date]
                );
                if (peerLeaves.length > 0) continue;

                if (time) {
                    const [peerConflicts] = await pool.query(
                        "SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled'",
                        [peer.id, date, time]
                    );
                    if (peerConflicts.length > 0) continue;
                }

                alternativeDoctors.push({
                    id: peer.id,
                    name: peer.doctor_name,
                    specialization: peer.specialization,
                    department_name: peer.department_name,
                    room_no: peer.room_no,
                    fee: peer.fee,
                    availability: peer.availability
                });
            }
        }

        res.json({
            doctor: {
                id: doctor.id,
                name: doctor.doctor_name,
                specialization: doctor.specialization,
                department_name: doctor.department_name,
                room_no: doctor.room_no,
                fee: doctor.fee,
                available_days: availableDays,
                start_time: doctor.start_time,
                end_time: doctor.end_time,
                slot_duration: doctor.slot_duration
            },
            date,
            day_of_week: dayOfWeek,
            is_working_day: isWorkingDay,
            is_on_leave: isOnLeave,
            time_checked: time || null,
            is_slot_booked: isSlotBooked,
            is_available: isAvailable,
            unavailability_reason: unavailabilityReason,
            booked_slots: bookedAppointments.map(a => a.appointment_time),
            booked_appointments: bookedAppointments,
            alternative_doctors: alternativeDoctors
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to check doctor availability.' });
    }
});

export default router;

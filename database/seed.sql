-- Medicare HMS Seed Data
-- Sunrise Multi-Speciality Hospital software engineering database mock values
-- Populates the 24 tables with consistent records for testing

USE medicare_hms;

-- Disable foreign key checks for clean seeding
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE announcements;
TRUNCATE TABLE patient_illnesses;
TRUNCATE TABLE insurance_policies;
TRUNCATE TABLE chat_messages;
TRUNCATE TABLE doctor_availability;
TRUNCATE TABLE payments;
TRUNCATE TABLE bill_items;
TRUNCATE TABLE bills;
TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE medicine_sale_items;
TRUNCATE TABLE medicine_sales;
TRUNCATE TABLE lab_reports;
TRUNCATE TABLE lab_requests;
TRUNCATE TABLE lab_tests;
TRUNCATE TABLE prescription_items;
TRUNCATE TABLE medicines;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE medical_records;
TRUNCATE TABLE appointments;
TRUNCATE TABLE patients;
TRUNCATE TABLE doctors;
TRUNCATE TABLE departments;
TRUNCATE TABLE users;
TRUNCATE TABLE roles;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Seed Roles
INSERT INTO roles (id, name) VALUES
(1, 'Admin'),
(2, 'Receptionist'),
(3, 'Doctor'),
(4, 'Laboratory Staff'),
(5, 'Pharmacist'),
(6, 'Billing Staff'),
(7, 'Patient');

-- 2. Seed Users (Password for all demo accounts is 'password123')
-- Bcrypt hash: $2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C
INSERT INTO users (id, full_name, email, password_hash, role_id) VALUES
(1, 'System Admin', 'admin@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 1),
(2, 'Sarah Jenkins', 'doctor@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 3),
(3, 'Rachel Adams', 'receptionist@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 2),
(4, 'Mark Taylor', 'lab@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 4),
(5, 'Emily Blunt', 'pharmacist@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 5),
(6, 'David Miller', 'billing@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 6),
(7, 'John Doe', 'patient@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', 7);

-- 3. Seed Departments
INSERT INTO departments (id, name, description) VALUES
(1, 'Cardiology', 'Heart & vascular system care'),
(2, 'Neurology', 'Brain & nervous system disorders'),
(3, 'Orthopedics', 'Bones & joints treatment'),
(4, 'Pediatrics', 'Child health care'),
(5, 'General Medicine', 'Adult primary care');

-- 4. Seed Doctors
INSERT INTO doctors (id, user_id, department_id, specialization, fee, room_no, availability, available_days, start_time, end_time, slot_duration) VALUES
(1, 2, 1, 'Interventional Cardiology', 800.00, 'Room 101', 'Mon-Fri: 09:00 AM - 04:00 PM', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]', '09:00:00', '16:00:00', 30);

-- 5. Seed Patients
INSERT INTO patients (id, user_id, phone, dob, gender, blood_group, emergency_contact, address, medical_history, incomplete) VALUES
(1, 7, '+91 98765 43210', '1990-05-15', 'Male', 'O+', '+91 98765 43210', '123, Park Street, Kolkata, West Bengal - 700016', 'Hypertension diagnosed in 2022', FALSE);

-- 6. Seed Appointments
INSERT INTO appointments (id, patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, reason) VALUES
(1, 1, 1, 1, '2026-08-01', '10:00 AM', 1, 'Scheduled', 'Routine cardiac follow-up checkup');

-- 7. Seed Medical Records
INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, diagnosis, clinical_notes, created_at) VALUES
(1, 1, 1, 1, 'Essential Hypertension', 'Vitals stable. BP is slightly high (135/85). Continue low sodium diet.', '2026-07-28');

-- 8. Seed Prescriptions
INSERT INTO prescriptions (id, medical_record_id, instructions) VALUES
(1, 1, 'Take medicines after meals.');

-- 9. Seed Medicines
INSERT INTO medicines (id, name, category, brand, unit_price, quantity) VALUES
(1, 'Paracetamol 650mg', 'Analgesic', 'Calpol', 5.00, 500),
(2, 'Atorvastatin 10mg', 'Cardiovascular', 'Lipitor', 18.50, 120),
(3, 'Amoxicillin 500mg', 'Antibiotic', 'Mox', 12.00, 80),
(4, 'Metformin 500mg', 'Antidiabetic', 'Glycomet', 8.00, 12),
(5, 'Aspirin 75mg', 'Antiplatelet', 'Ecosprin', 4.50, 300);

-- 10. Seed Prescription Items
INSERT INTO prescription_items (id, prescription_id, medicine_id, dosage, duration, quantity) VALUES
(1, 1, 2, '0-0-1', '10 Days', 10),
(2, 1, 5, '1-0-0', '30 Days', 30);

-- 11. Seed Lab Tests
INSERT INTO lab_tests (id, test_name, cost) VALUES
(1, 'Complete Blood Count (CBC)', 350.00),
(2, 'Lipid Profile', 650.00),
(3, 'Chest X-Ray (PA View)', 800.00),
(4, 'Electrocardiogram (ECG)', 500.00);

-- 12. Seed Lab Requests
INSERT INTO lab_requests (id, appointment_id, patient_id, doctor_id, lab_test_id, status, notes, date, time_slot, operator_name, report_url, requested_at) VALUES
(1, 1, 1, 1, 4, 'Completed', 'Normal sinus rhythm detected.', '2026-07-28', '11:00 AM', 'Mark Taylor', 'ECG_Report_Normal.pdf', '2026-07-28');

-- 13. Seed Lab Reports
INSERT INTO lab_reports (id, lab_request_id, report_url, notes) VALUES
(1, 1, 'ECG_Report_Normal.pdf', 'Normal sinus rhythm detected.');

-- 14. Seed Bills
INSERT INTO bills (id, patient_id, appointment_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at) VALUES
(1, 1, 1, 800.00, 50.00, 45.00, 795.00, 'Paid', 'Online', 'TXN-987654321', '2026-07-28');

-- 15. Seed Bill Items
INSERT INTO bill_items (id, bill_id, item_name, amount, quantity) VALUES
(1, 1, 'Doctor Consultation Charge', 800.00, 1);

-- 16. Seed Payments
INSERT INTO payments (id, bill_id, medicine_sale_id, amount, payment_method, transaction_reference) VALUES
(1, 1, NULL, 795.00, 'Online', 'TXN-987654321');

-- 17. Seed Chat Messages
INSERT INTO chat_messages (id, sender_id, receiver_id, message) VALUES
(1, 2, 7, 'Hello John, how are you feeling today with your new blood pressure medicines?'),
(2, 7, 2, 'Doctor Jenkins, I feel much better, chest pain is gone but feeling a bit dry-mouthed.');

-- 18. Seed Insurance Policies
INSERT INTO insurance_policies (id, patient_id, provider, policy_no, coverage) VALUES
(1, 1, 'Star Health Insurance', 'SH-87910-A', 500000.00);

-- 19. Seed Patient Illnesses
INSERT INTO patient_illnesses (id, patient_id, condition_name, year, status, remarks) VALUES
(1, 1, 'Essential Hypertension', '2022', 'Active', 'Under medication');

-- 20. Seed Announcements
INSERT INTO announcements (id, title, content, created_by) VALUES
(1, 'Annual Health Camp', 'Free cardiovascular checkup camp organized this Sunday from 9 AM to 2 PM at OPD Annex Room 1.', 1);

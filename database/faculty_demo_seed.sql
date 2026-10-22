-- =============================================================================
-- MediCare HMS - Optional Faculty Demo Dataset (Idempotent Seed)
-- =============================================================================
-- NOTICE: All records in this dataset are strictly fictional demo records.
-- MARKED: FICTIONAL DEMO DATA — NOT FOR CLINICAL USE.
--
-- Safety Guarantees:
-- 1. Non-Destructive: Does NOT drop, truncate, or overwrite existing tables.
-- 2. Idempotent: Every statement checks for existing records before inserting.
-- 3. Dynamic Key Resolution: Resolves role IDs, department IDs, and foreign keys
--    dynamically without relying on fixed auto-increment IDs.
-- 4. Scoped Isolation: All accounts use the reserved 'demo.faculty.*@medicare.com'
--    namespace for clean, unambiguous identification and rollback.
-- =============================================================================

USE medicare_hms;

-- -----------------------------------------------------------------------------
-- 1. Resolve Role IDs Dynamically
-- -----------------------------------------------------------------------------
SET @role_doctor_id = (SELECT id FROM roles WHERE name = 'Doctor');
SET @role_patient_id = (SELECT id FROM roles WHERE name = 'Patient');
SET @role_lab_id = (SELECT id FROM roles WHERE name = 'Laboratory Staff');

-- -----------------------------------------------------------------------------
-- 2. Resolve Department IDs Dynamically
-- -----------------------------------------------------------------------------
SET @dept_cardio_id = (SELECT id FROM departments WHERE name = 'Cardiology');
SET @dept_neuro_id = (SELECT id FROM departments WHERE name = 'Neurology');
SET @dept_ortho_id = (SELECT id FROM departments WHERE name = 'Orthopedics');
SET @dept_pedia_id = (SELECT id FROM departments WHERE name = 'Pediatrics');
SET @dept_genmed_id = (SELECT id FROM departments WHERE name = 'General Medicine');

-- -----------------------------------------------------------------------------
-- 3. Resolve Catalog Test & Medicine IDs Dynamically
-- -----------------------------------------------------------------------------
SET @med_atorvastatin_id = (SELECT id FROM medicines WHERE name LIKE 'Atorvastatin%' LIMIT 1);
SET @med_aspirin_id = (SELECT id FROM medicines WHERE name LIKE 'Aspirin%' LIMIT 1);
SET @med_paracetamol_id = (SELECT id FROM medicines WHERE name LIKE 'Paracetamol%' LIMIT 1);
SET @med_metformin_id = (SELECT id FROM medicines WHERE name LIKE 'Metformin%' LIMIT 1);

-- Ensure expanded catalog lab tests exist in lab_tests table
INSERT INTO lab_tests (test_name, cost) SELECT 'Complete Blood Count (CBC)', 350.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Complete Blood Count (CBC)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Lipid Profile', 650.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Lipid Profile');
INSERT INTO lab_tests (test_name, cost) SELECT 'Chest X-Ray (PA View)', 800.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Chest X-Ray (PA View)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Electrocardiogram (ECG)', 500.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Electrocardiogram (ECG)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Liver Function Test (LFT)', 750.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Liver Function Test (LFT)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Kidney Function Test (KFT/RFT)', 700.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Kidney Function Test (KFT/RFT)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Thyroid Profile Total (T3, T4, TSH)', 550.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Thyroid Profile Total (T3, T4, TSH)');
INSERT INTO lab_tests (test_name, cost) SELECT 'HbA1c & Fasting Blood Glucose', 450.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'HbA1c & Fasting Blood Glucose');
INSERT INTO lab_tests (test_name, cost) SELECT 'Urine Routine & Microscopy (CUE)', 250.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Urine Routine & Microscopy (CUE)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Serum Electrolytes (Na+, K+, Cl-)', 500.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Serum Electrolytes (Na+, K+, Cl-)');
INSERT INTO lab_tests (test_name, cost) SELECT 'Vitamin D3 & Vitamin B12 Duo', 1400.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Vitamin D3 & Vitamin B12 Duo');
INSERT INTO lab_tests (test_name, cost) SELECT 'Ultrasound (USG) Abdomen & Pelvis', 1200.00 WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE test_name = 'Ultrasound (USG) Abdomen & Pelvis');

SET @test_ecg_id = (SELECT id FROM lab_tests WHERE test_name LIKE '%Electrocardiogram%' LIMIT 1);
SET @test_lipid_id = (SELECT id FROM lab_tests WHERE test_name LIKE '%Lipid%' LIMIT 1);
SET @test_cbc_id = (SELECT id FROM lab_tests WHERE test_name LIKE '%Complete Blood Count%' LIMIT 1);

-- -----------------------------------------------------------------------------
-- 4. Seed Faculty Demo Doctor Users & Laboratory Staff Users
-- Bcrypt Hash for password 'password123': $2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C
-- -----------------------------------------------------------------------------
INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Dr. Rajesh Mehta', 'demo.faculty.dr.mehta@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_doctor_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.dr.mehta@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Dr. Sunita Rao', 'demo.faculty.dr.rao@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_doctor_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.dr.rao@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Dr. Vikram Patel', 'demo.faculty.dr.patel@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_doctor_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.dr.patel@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Dr. Arvind Kulkarni', 'demo.faculty.dr.kulkarni@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_doctor_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.dr.kulkarni@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Dr. Priya Swaminathan', 'demo.faculty.dr.swaminathan@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_doctor_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.dr.swaminathan@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Pooja Sharma', 'demo.faculty.pooja.lab@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_lab_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.pooja.lab@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Arjun Verma', 'demo.faculty.arjun.lab@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_lab_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.arjun.lab@medicare.com');

-- -----------------------------------------------------------------------------
-- 5. Seed Faculty Demo Doctor Profiles
-- -----------------------------------------------------------------------------
SET @user_mehta_id = (SELECT id FROM users WHERE email = 'demo.faculty.dr.mehta@medicare.com');
SET @user_rao_id = (SELECT id FROM users WHERE email = 'demo.faculty.dr.rao@medicare.com');
SET @user_patel_id = (SELECT id FROM users WHERE email = 'demo.faculty.dr.patel@medicare.com');
SET @user_kulkarni_id = (SELECT id FROM users WHERE email = 'demo.faculty.dr.kulkarni@medicare.com');
SET @user_swaminathan_id = (SELECT id FROM users WHERE email = 'demo.faculty.dr.swaminathan@medicare.com');

INSERT INTO doctors (user_id, department_id, specialization, fee, room_no, availability, available_days, start_time, end_time, slot_duration)
SELECT @user_mehta_id, @dept_cardio_id, 'Cardiology & Preventive Heart Care', 800.00, 'Room 102', 'Mon-Fri: 09:00 AM - 04:00 PM', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]', '09:00:00', '16:00:00', 30
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = @user_mehta_id);

INSERT INTO doctors (user_id, department_id, specialization, fee, room_no, availability, available_days, start_time, end_time, slot_duration)
SELECT @user_rao_id, @dept_neuro_id, 'Neurology & Headache Management', 900.00, 'Room 204', 'Mon-Thu: 10:00 AM - 04:00 PM', '["Monday", "Tuesday", "Wednesday", "Thursday"]', '10:00:00', '16:00:00', 30
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = @user_rao_id);

INSERT INTO doctors (user_id, department_id, specialization, fee, room_no, availability, available_days, start_time, end_time, slot_duration)
SELECT @user_patel_id, @dept_genmed_id, 'Internal Medicine & Chronic Disease Care', 650.00, 'Room 105', 'Mon-Sat: 09:30 AM - 05:00 PM', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]', '09:30:00', '17:00:00', 30
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = @user_patel_id);

INSERT INTO doctors (user_id, department_id, specialization, fee, room_no, availability, available_days, start_time, end_time, slot_duration)
SELECT @user_kulkarni_id, @dept_ortho_id, 'Orthopedic Surgery & Joint Replacement', 950.00, 'Room 201', 'Mon-Sat: 10:00 AM - 04:30 PM', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]', '10:00:00', '16:30:00', 30
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = @user_kulkarni_id);

INSERT INTO doctors (user_id, department_id, specialization, fee, room_no, availability, available_days, start_time, end_time, slot_duration)
SELECT @user_swaminathan_id, @dept_pedia_id, 'Pediatrics & Child Developmental Health', 700.00, 'Room 108', 'Mon-Fri: 09:30 AM - 03:30 PM', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]', '09:30:00', '15:30:00', 30
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = @user_swaminathan_id);

-- -----------------------------------------------------------------------------
-- 6. Seed Faculty Demo Patient Users
-- -----------------------------------------------------------------------------
INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Amit Kumar', 'demo.faculty.amit.kumar@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_patient_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.amit.kumar@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Priya Nair', 'demo.faculty.priya.nair@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_patient_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.priya.nair@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Suresh Deshmukh', 'demo.faculty.suresh.deshmukh@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_patient_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.suresh.deshmukh@medicare.com');

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Kavita Reddy', 'demo.faculty.kavita.reddy@medicare.com', '$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C', @role_patient_id
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.faculty.kavita.reddy@medicare.com');

-- -----------------------------------------------------------------------------
-- 7. Seed Faculty Demo Patient Profiles
-- -----------------------------------------------------------------------------
SET @user_amit_id = (SELECT id FROM users WHERE email = 'demo.faculty.amit.kumar@medicare.com');
SET @user_priya_id = (SELECT id FROM users WHERE email = 'demo.faculty.priya.nair@medicare.com');
SET @user_suresh_id = (SELECT id FROM users WHERE email = 'demo.faculty.suresh.deshmukh@medicare.com');
SET @user_kavita_id = (SELECT id FROM users WHERE email = 'demo.faculty.kavita.reddy@medicare.com');

INSERT INTO patients (user_id, phone, dob, gender, blood_group, emergency_contact, address, medical_history, incomplete)
SELECT @user_amit_id, '+91 98201 12345', '1982-08-14', 'Male', 'O+', '+91 98201 12346', 'Flat 402, Sea Breeze Apts, Bandra West, Mumbai, Maharashtra - 400050', 'Essential Hypertension diagnosed in 2021. Low salt diet recommended. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', FALSE
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE user_id = @user_amit_id);

INSERT INTO patients (user_id, phone, dob, gender, blood_group, emergency_contact, address, medical_history, incomplete)
SELECT @user_priya_id, '+91 98450 67890', '1988-11-20', 'Female', 'B+', '+91 98450 67891', '12/A, 4th Cross, Indiranagar, Bengaluru, Karnataka - 560038', 'History of episodic migraine with visual aura. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', FALSE
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE user_id = @user_priya_id);

INSERT INTO patients (user_id, phone, dob, gender, blood_group, emergency_contact, address, medical_history, incomplete)
SELECT @user_suresh_id, '+91 97654 32101', '1966-03-05', 'Male', 'A+', '+91 97654 32102', 'B-104, Shanti Nagar, Kothrud, Pune, Maharashtra - 411038', 'Type 2 Diabetes Mellitus under oral hypoglycemic treatment. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', FALSE
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE user_id = @user_suresh_id);

INSERT INTO patients (user_id, phone, dob, gender, blood_group, emergency_contact, address, medical_history, incomplete)
SELECT @user_kavita_id, '+91 98840 54321', '1995-07-22', 'Female', 'AB+', '+91 98840 54322', 'Plot 28, Jubilee Hills, Road No 36, Hyderabad, Telangana - 500033', 'Seasonal allergic rhinitis and occasional acute bronchitis. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', FALSE
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE user_id = @user_kavita_id);

-- Resolve Doctor & Patient Profile IDs
SET @doc_mehta_id = (SELECT id FROM doctors WHERE user_id = @user_mehta_id);
SET @doc_rao_id = (SELECT id FROM doctors WHERE user_id = @user_rao_id);
SET @doc_patel_id = (SELECT id FROM doctors WHERE user_id = @user_patel_id);

SET @pat_amit_id = (SELECT id FROM patients WHERE user_id = @user_amit_id);
SET @pat_priya_id = (SELECT id FROM patients WHERE user_id = @user_priya_id);
SET @pat_suresh_id = (SELECT id FROM patients WHERE user_id = @user_suresh_id);
SET @pat_kavita_id = (SELECT id FROM patients WHERE user_id = @user_kavita_id);

-- -----------------------------------------------------------------------------
-- 8. Seed Insurance Policies & Patient Illnesses
-- -----------------------------------------------------------------------------
INSERT INTO insurance_policies (patient_id, provider, policy_no, coverage)
SELECT @pat_amit_id, 'Star Health & Allied Insurance', 'DEMO-SH-99214-IN', 500000.00
WHERE NOT EXISTS (SELECT 1 FROM insurance_policies WHERE patient_id = @pat_amit_id AND policy_no = 'DEMO-SH-99214-IN');

INSERT INTO insurance_policies (patient_id, provider, policy_no, coverage)
SELECT @pat_priya_id, 'HDFC ERGO General Insurance', 'DEMO-HE-66712-IN', 750000.00
WHERE NOT EXISTS (SELECT 1 FROM insurance_policies WHERE patient_id = @pat_priya_id AND policy_no = 'DEMO-HE-66712-IN');

INSERT INTO insurance_policies (patient_id, provider, policy_no, coverage)
SELECT @pat_suresh_id, 'New India Assurance Co. Ltd.', 'DEMO-NIA-33201-IN', 400000.00
WHERE NOT EXISTS (SELECT 1 FROM insurance_policies WHERE patient_id = @pat_suresh_id AND policy_no = 'DEMO-NIA-33201-IN');

INSERT INTO patient_illnesses (patient_id, condition_name, year, status, remarks)
SELECT @pat_amit_id, 'Essential Hypertension', '2021', 'Active', 'Controlled with DASH diet and oral medication. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_illnesses WHERE patient_id = @pat_amit_id AND condition_name = 'Essential Hypertension');

INSERT INTO patient_illnesses (patient_id, condition_name, year, status, remarks)
SELECT @pat_priya_id, 'Episodic Migraine', '2023', 'Active', 'Triggered by sleep deprivation. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_illnesses WHERE patient_id = @pat_priya_id AND condition_name = 'Episodic Migraine');

INSERT INTO patient_illnesses (patient_id, condition_name, year, status, remarks)
SELECT @pat_suresh_id, 'Type 2 Diabetes Mellitus', '2019', 'Chronic', 'Under routine glycemic monitoring. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_illnesses WHERE patient_id = @pat_suresh_id AND condition_name = 'Type 2 Diabetes Mellitus');

-- -----------------------------------------------------------------------------
-- 9. Seed Appointments (Completed & Scheduled)
-- -----------------------------------------------------------------------------
INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason, record_sharing_consent)
SELECT @pat_amit_id, @doc_mehta_id, @dept_cardio_id, '2026-10-10', '10:00 AM', 1, 'Completed', 'OPD Consultation', 'Cardiology evaluation for intermittent elevated blood pressure and palpitations. [FICTIONAL DEMO DATA]', TRUE
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = @pat_amit_id AND doctor_id = @doc_mehta_id AND appointment_date = '2026-10-10' AND appointment_time = '10:00 AM');

INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason, record_sharing_consent)
SELECT @pat_amit_id, @doc_mehta_id, @dept_cardio_id, '2026-10-28', '11:00 AM', 3, 'Scheduled', 'Follow-up Consultation', 'Review of repeat Lipid Profile and ECG response following dosage adjustment. [FICTIONAL DEMO DATA]', TRUE
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = @pat_amit_id AND doctor_id = @doc_mehta_id AND appointment_date = '2026-10-28' AND appointment_time = '11:00 AM');

INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason, record_sharing_consent)
SELECT @pat_priya_id, @doc_rao_id, @dept_neuro_id, '2026-10-14', '10:30 AM', 2, 'Completed', 'OPD Consultation', 'Severe unilateral throbbing headache with photophobia and nausea. [FICTIONAL DEMO DATA]', TRUE
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = @pat_priya_id AND doctor_id = @doc_rao_id AND appointment_date = '2026-10-14' AND appointment_time = '10:30 AM');

INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason, record_sharing_consent)
SELECT @pat_suresh_id, @doc_patel_id, @dept_genmed_id, '2026-10-18', '11:30 AM', 4, 'Completed', 'OPD Consultation', 'Quarterly diabetic metabolic checkup and routine glycemic evaluation. [FICTIONAL DEMO DATA]', TRUE
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = @pat_suresh_id AND doctor_id = @doc_patel_id AND appointment_date = '2026-10-18' AND appointment_time = '11:30 AM');

INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, appointment_time, token_number, status, consultation_type, reason, record_sharing_consent)
SELECT @pat_kavita_id, @doc_patel_id, @dept_genmed_id, '2026-10-25', '02:30 PM', 5, 'Scheduled', 'OPD Consultation', 'Persistent dry cough and mild seasonal bronchial congestion. [FICTIONAL DEMO DATA]', FALSE
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = @pat_kavita_id AND doctor_id = @doc_patel_id AND appointment_date = '2026-10-25' AND appointment_time = '02:30 PM');

-- Resolve Appointment IDs
SET @apt_amit_cardio1_id = (SELECT id FROM appointments WHERE patient_id = @pat_amit_id AND doctor_id = @doc_mehta_id AND appointment_date = '2026-10-10');
SET @apt_amit_cardio2_id = (SELECT id FROM appointments WHERE patient_id = @pat_amit_id AND doctor_id = @doc_mehta_id AND appointment_date = '2026-10-28');
SET @apt_priya_neuro1_id = (SELECT id FROM appointments WHERE patient_id = @pat_priya_id AND doctor_id = @doc_rao_id AND appointment_date = '2026-10-14');
SET @apt_suresh_genmed1_id = (SELECT id FROM appointments WHERE patient_id = @pat_suresh_id AND doctor_id = @doc_patel_id AND appointment_date = '2026-10-18');

-- -----------------------------------------------------------------------------
-- 10. Seed Medical Records (Consultations)
-- -----------------------------------------------------------------------------
INSERT INTO medical_records (appointment_id, patient_id, doctor_id, chief_complaint, examination_findings, diagnosis, clinical_notes, followup_instructions, created_at)
SELECT @apt_amit_cardio1_id, @pat_amit_id, @doc_mehta_id, 'Occasional morning headache and exertional palpitations for the past 3 weeks. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', 'BP: 142/90 mmHg, Pulse: 78 bpm regular, SpO2: 99% on room air, BMI: 25.4. S1 S2 heard normal.', 'Stage 1 Essential Hypertension with mild dyslipidemia', 'Cardiovascular assessment stable. Mild systolic/diastolic elevation. Advised lifestyle modifications including DASH diet and daily aerobic exercise. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', 'Follow-up in 2-3 weeks with fasting lipid profile and 12-lead ECG.', '2026-10-10'
WHERE NOT EXISTS (SELECT 1 FROM medical_records WHERE appointment_id = @apt_amit_cardio1_id);

INSERT INTO medical_records (appointment_id, patient_id, doctor_id, chief_complaint, examination_findings, diagnosis, clinical_notes, followup_instructions, created_at)
SELECT @apt_priya_neuro1_id, @pat_priya_id, @doc_rao_id, 'Throbbing left hemicranial headache lasting 12-24 hours accompanied by nausea and photophobia. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', 'BP: 118/76 mmHg, Pulse: 72 bpm. Cranial nerves II-XII grossly intact. No focal neurological deficits.', 'Episodic Migraine without Aura', 'Trigger identification reviewed (irregular sleep, screen strain). Prescribed prophylactic and abortive regimen. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', 'Maintain headache diary. Review in 4 weeks or earlier if symptom frequency increases.', '2026-10-14'
WHERE NOT EXISTS (SELECT 1 FROM medical_records WHERE appointment_id = @apt_priya_neuro1_id);

INSERT INTO medical_records (appointment_id, patient_id, doctor_id, chief_complaint, examination_findings, diagnosis, clinical_notes, followup_instructions, created_at)
SELECT @apt_suresh_genmed1_id, @pat_suresh_id, @doc_patel_id, 'Routine quarterly diabetes review. Mild post-prandial lethargy. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', 'BP: 126/82 mmHg, Pulse: 74 bpm. Foot inspection: bilateral peripheral pulses palpable, monofilament sensation intact.', 'Type 2 Diabetes Mellitus - Moderate Glycemic Control', 'Continue oral antidiabetic therapy. Dietary adherence reinforced. Foot care counseling provided. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', 'Review fasting/post-prandial blood glucose and HbA1c in 3 months.', '2026-10-18'
WHERE NOT EXISTS (SELECT 1 FROM medical_records WHERE appointment_id = @apt_suresh_genmed1_id);

-- Resolve Medical Record IDs
SET @mr_amit_id = (SELECT id FROM medical_records WHERE appointment_id = @apt_amit_cardio1_id);
SET @mr_priya_id = (SELECT id FROM medical_records WHERE appointment_id = @apt_priya_neuro1_id);
SET @mr_suresh_id = (SELECT id FROM medical_records WHERE appointment_id = @apt_suresh_genmed1_id);

-- -----------------------------------------------------------------------------
-- 11. Seed Prescriptions & Prescription Items
-- -----------------------------------------------------------------------------
INSERT INTO prescriptions (medical_record_id, instructions)
SELECT @mr_amit_id, 'Take tablets after meals. Reduce dietary sodium intake and avoid caffeine. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM prescriptions WHERE medical_record_id = @mr_amit_id);

INSERT INTO prescriptions (medical_record_id, instructions)
SELECT @mr_priya_id, 'Take medications with plenty of water. Rest in a dark, quiet room during acute attacks. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM prescriptions WHERE medical_record_id = @mr_priya_id);

INSERT INTO prescriptions (medical_record_id, instructions)
SELECT @mr_suresh_id, 'Take oral antidiabetics strictly before/with breakfast and dinner as directed. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM prescriptions WHERE medical_record_id = @mr_suresh_id);

SET @presc_amit_id = (SELECT id FROM prescriptions WHERE medical_record_id = @mr_amit_id);
SET @presc_priya_id = (SELECT id FROM prescriptions WHERE medical_record_id = @mr_priya_id);
SET @presc_suresh_id = (SELECT id FROM prescriptions WHERE medical_record_id = @mr_suresh_id);

-- Prescription items for Amit Kumar
INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity)
SELECT @presc_amit_id, @med_atorvastatin_id, '0-0-1', '30 Days', 30
WHERE NOT EXISTS (SELECT 1 FROM prescription_items WHERE prescription_id = @presc_amit_id AND medicine_id = @med_atorvastatin_id);

INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity)
SELECT @presc_amit_id, @med_aspirin_id, '1-0-0', '30 Days', 30
WHERE NOT EXISTS (SELECT 1 FROM prescription_items WHERE prescription_id = @presc_amit_id AND medicine_id = @med_aspirin_id);

-- Prescription items for Priya Nair
INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity)
SELECT @presc_priya_id, @med_paracetamol_id, '1-0-1', '5 Days', 10
WHERE NOT EXISTS (SELECT 1 FROM prescription_items WHERE prescription_id = @presc_priya_id AND medicine_id = @med_paracetamol_id);

-- Prescription items for Suresh Deshmukh
INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity)
SELECT @presc_suresh_id, @med_metformin_id, '1-0-1', '30 Days', 60
WHERE NOT EXISTS (SELECT 1 FROM prescription_items WHERE prescription_id = @presc_suresh_id AND medicine_id = @med_metformin_id);

-- -----------------------------------------------------------------------------
-- 12. Seed Lab Requests & Reports
-- -----------------------------------------------------------------------------
INSERT INTO lab_requests (appointment_id, patient_id, doctor_id, lab_test_id, status, notes, date, time_slot, operator_name, report_url, requested_at)
SELECT @apt_amit_cardio1_id, @pat_amit_id, @doc_mehta_id, @test_ecg_id, 'Completed', 'Normal sinus rhythm, HR 74 bpm. Normal axis, no ST-T wave abnormalities. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', '2026-10-10', '11:00 AM', 'Mark Taylor', 'demo_faculty_ecg_amit_kumar.pdf', '2026-10-10'
WHERE NOT EXISTS (SELECT 1 FROM lab_requests WHERE patient_id = @pat_amit_id AND lab_test_id = @test_ecg_id AND requested_at = '2026-10-10');

INSERT INTO lab_requests (appointment_id, patient_id, doctor_id, lab_test_id, status, notes, date, time_slot, operator_name, report_url, requested_at)
SELECT @apt_amit_cardio1_id, @pat_amit_id, @doc_mehta_id, @test_lipid_id, 'Completed', 'Total Cholesterol: 215 mg/dL, Triglycerides: 165 mg/dL, HDL: 44 mg/dL, LDL: 138 mg/dL. Mild borderline elevation. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', '2026-10-11', '09:00 AM', 'Mark Taylor', 'demo_faculty_lipid_profile_amit_kumar.pdf', '2026-10-10'
WHERE NOT EXISTS (SELECT 1 FROM lab_requests WHERE patient_id = @pat_amit_id AND lab_test_id = @test_lipid_id AND requested_at = '2026-10-10');

INSERT INTO lab_requests (appointment_id, patient_id, doctor_id, lab_test_id, status, notes, date, time_slot, operator_name, report_url, requested_at)
SELECT @apt_priya_neuro1_id, @pat_priya_id, @doc_rao_id, @test_cbc_id, 'Completed', 'Hemoglobin: 13.8 g/dL, Total Leukocyte Count: 6,800 /mcL, Platelets: 240,000 /mcL. Normal hematological profile. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', '2026-10-14', '11:30 AM', 'Mark Taylor', 'demo_faculty_cbc_priya_nair.pdf', '2026-10-14'
WHERE NOT EXISTS (SELECT 1 FROM lab_requests WHERE patient_id = @pat_priya_id AND lab_test_id = @test_cbc_id AND requested_at = '2026-10-14');

INSERT INTO lab_requests (appointment_id, patient_id, doctor_id, lab_test_id, status, notes, date, time_slot, operator_name, report_url, requested_at)
SELECT NULL, @pat_suresh_id, @doc_patel_id, @test_cbc_id, 'Scheduled', 'Routine hematology screening. Sample collection scheduled for morning fasting slot. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]', '2026-10-24', '08:30 AM', NULL, NULL, '2026-10-18'
WHERE NOT EXISTS (SELECT 1 FROM lab_requests WHERE patient_id = @pat_suresh_id AND lab_test_id = @test_cbc_id AND requested_at = '2026-10-18');

-- Link Lab Reports
SET @req_ecg_id = (SELECT id FROM lab_requests WHERE patient_id = @pat_amit_id AND lab_test_id = @test_ecg_id AND requested_at = '2026-10-10');
SET @req_lipid_id = (SELECT id FROM lab_requests WHERE patient_id = @pat_amit_id AND lab_test_id = @test_lipid_id AND requested_at = '2026-10-10');
SET @req_cbc_priya_id = (SELECT id FROM lab_requests WHERE patient_id = @pat_priya_id AND lab_test_id = @test_cbc_id AND requested_at = '2026-10-14');

INSERT INTO lab_reports (lab_request_id, report_url, notes)
SELECT @req_ecg_id, 'demo_faculty_ecg_amit_kumar.pdf', 'Normal sinus rhythm, HR 74 bpm. Normal axis, no ST-T wave abnormalities. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM lab_reports WHERE lab_request_id = @req_ecg_id);

INSERT INTO lab_reports (lab_request_id, report_url, notes)
SELECT @req_lipid_id, 'demo_faculty_lipid_profile_amit_kumar.pdf', 'Total Cholesterol: 215 mg/dL, Triglycerides: 165 mg/dL, LDL: 138 mg/dL. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM lab_reports WHERE lab_request_id = @req_lipid_id);

INSERT INTO lab_reports (lab_request_id, report_url, notes)
SELECT @req_cbc_priya_id, 'demo_faculty_cbc_priya_nair.pdf', 'Hemoglobin: 13.8 g/dL, Platelets: 240,000 /mcL. Normal hematological profile. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM lab_reports WHERE lab_request_id = @req_cbc_priya_id);

-- -----------------------------------------------------------------------------
-- 13. Seed Patient Documents & Appointment Shared Records
-- -----------------------------------------------------------------------------
INSERT INTO patient_documents (patient_id, title, category, document_type, source, doctor_name, facility_name, document_date, file_url, notes)
SELECT @pat_amit_id, 'Baseline 12-Lead ECG Report', 'Report', 'Cardiovascular / Electrocardiography', 'Lab Generated', 'Dr. Rajesh Mehta', 'Sunrise Multi-Speciality Hospital', '2026-10-10', 'demo_faculty_ecg_amit_kumar.pdf', 'Normal sinus rhythm with normal axis. Vitals stable at time of recording. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_documents WHERE patient_id = @pat_amit_id AND title = 'Baseline 12-Lead ECG Report');

INSERT INTO patient_documents (patient_id, title, category, document_type, source, doctor_name, facility_name, document_date, file_url, notes)
SELECT @pat_amit_id, 'Comprehensive Lipid Profile Report', 'Report', 'Biochemistry / Lipid Panel', 'Lab Generated', 'Dr. Rajesh Mehta', 'Sunrise Multi-Speciality Hospital', '2026-10-11', 'demo_faculty_lipid_profile_amit_kumar.pdf', 'Total Cholesterol 215 mg/dL, LDL 138 mg/dL, HDL 44 mg/dL. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_documents WHERE patient_id = @pat_amit_id AND title = 'Comprehensive Lipid Profile Report');

INSERT INTO patient_documents (patient_id, title, category, document_type, source, doctor_name, facility_name, document_date, file_url, notes)
SELECT @pat_priya_id, 'Brain MRI Screening (Non-Contrast)', 'Report', 'Neuroradiology / MRI Scan', 'Patient Upload', 'Dr. Sunita Rao', 'Apex Imaging & Diagnostic Center, Bengaluru', '2026-09-30', 'demo_faculty_mri_priya_nair.pdf', 'Normal intracranial study. No acute infarction, hemorrhage, or mass effect. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_documents WHERE patient_id = @pat_priya_id AND title = 'Brain MRI Screening (Non-Contrast)');

INSERT INTO patient_documents (patient_id, title, category, document_type, source, doctor_name, facility_name, document_date, file_url, notes)
SELECT @pat_suresh_id, 'Fasting Blood Sugar & HbA1c Report', 'Report', 'Biochemistry / Glycemic Profile', 'Patient Upload', 'Dr. Vikram Patel', 'Metropolis Healthcare Diagnostic Labs, Pune', '2026-10-05', 'demo_faculty_hba1c_suresh_deshmukh.pdf', 'Fasting Blood Sugar: 132 mg/dL, HbA1c: 7.1%. Moderate glycemic control under oral medication. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM patient_documents WHERE patient_id = @pat_suresh_id AND title = 'Fasting Blood Sugar & HbA1c Report');

-- Link Shared Records to Appointment 2
SET @doc_amit_ecg_id = (SELECT id FROM patient_documents WHERE patient_id = @pat_amit_id AND title = 'Baseline 12-Lead ECG Report');
SET @doc_amit_lipid_id = (SELECT id FROM patient_documents WHERE patient_id = @pat_amit_id AND title = 'Comprehensive Lipid Profile Report');

INSERT INTO appointment_shared_records (appointment_id, patient_id, doctor_id, document_id, category)
SELECT @apt_amit_cardio2_id, @pat_amit_id, @doc_mehta_id, @doc_amit_ecg_id, 'Report'
WHERE NOT EXISTS (SELECT 1 FROM appointment_shared_records WHERE appointment_id = @apt_amit_cardio2_id AND document_id = @doc_amit_ecg_id);

INSERT INTO appointment_shared_records (appointment_id, patient_id, doctor_id, document_id, category)
SELECT @apt_amit_cardio2_id, @pat_amit_id, @doc_mehta_id, @doc_amit_lipid_id, 'Report'
WHERE NOT EXISTS (SELECT 1 FROM appointment_shared_records WHERE appointment_id = @apt_amit_cardio2_id AND document_id = @doc_amit_lipid_id);

-- -----------------------------------------------------------------------------
-- 14. Seed Bills, Bill Items, and Payments (INR Amounts)
-- -----------------------------------------------------------------------------
-- Bill 1: Amit Kumar (Paid in INR)
INSERT INTO bills (patient_id, appointment_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at)
SELECT @pat_amit_id, @apt_amit_cardio1_id, 1300.00, 50.00, 62.50, 1312.50, 'Paid', 'UPI', 'UPI-DEMO-TXN-IN78901', '2026-10-10'
WHERE NOT EXISTS (SELECT 1 FROM bills WHERE patient_id = @pat_amit_id AND appointment_id = @apt_amit_cardio1_id AND created_at = '2026-10-10');

SET @bill_amit_id = (SELECT id FROM bills WHERE patient_id = @pat_amit_id AND appointment_id = @apt_amit_cardio1_id AND created_at = '2026-10-10');

INSERT INTO bill_items (bill_id, item_name, amount, quantity)
SELECT @bill_amit_id, 'Doctor Consultation Fee - Dr. Rajesh Mehta (Cardiology)', 800.00, 1
WHERE NOT EXISTS (SELECT 1 FROM bill_items WHERE bill_id = @bill_amit_id AND item_name LIKE '%Doctor Consultation Fee%');

INSERT INTO bill_items (bill_id, item_name, amount, quantity)
SELECT @bill_amit_id, 'Electrocardiogram (ECG) Diagnostic Procedure', 500.00, 1
WHERE NOT EXISTS (SELECT 1 FROM bill_items WHERE bill_id = @bill_amit_id AND item_name LIKE '%Electrocardiogram%');

INSERT INTO payments (bill_id, medicine_sale_id, amount, payment_method, transaction_reference)
SELECT @bill_amit_id, NULL, 1312.50, 'UPI', 'UPI-DEMO-TXN-IN78901'
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE bill_id = @bill_amit_id AND transaction_reference = 'UPI-DEMO-TXN-IN78901');

-- Bill 2: Priya Nair (Paid in INR)
INSERT INTO bills (patient_id, appointment_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at)
SELECT @pat_priya_id, @apt_priya_neuro1_id, 900.00, 0.00, 45.00, 945.00, 'Paid', 'Net Banking', 'NB-HDFC-DEMO-44321', '2026-10-14'
WHERE NOT EXISTS (SELECT 1 FROM bills WHERE patient_id = @pat_priya_id AND appointment_id = @apt_priya_neuro1_id AND created_at = '2026-10-14');

SET @bill_priya_id = (SELECT id FROM bills WHERE patient_id = @pat_priya_id AND appointment_id = @apt_priya_neuro1_id AND created_at = '2026-10-14');

INSERT INTO bill_items (bill_id, item_name, amount, quantity)
SELECT @bill_priya_id, 'Specialist Consultation Fee - Dr. Sunita Rao (Neurology)', 900.00, 1
WHERE NOT EXISTS (SELECT 1 FROM bill_items WHERE bill_id = @bill_priya_id AND item_name LIKE '%Specialist Consultation Fee%');

INSERT INTO payments (bill_id, medicine_sale_id, amount, payment_method, transaction_reference)
SELECT @bill_priya_id, NULL, 945.00, 'Net Banking', 'NB-HDFC-DEMO-44321'
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE bill_id = @bill_priya_id AND transaction_reference = 'NB-HDFC-DEMO-44321');

-- Bill 3: Suresh Deshmukh (Pending in INR)
INSERT INTO bills (patient_id, appointment_id, total_amount, discount, tax, net_amount, status, payment_method, payment_details, created_at)
SELECT @pat_suresh_id, @apt_suresh_genmed1_id, 650.00, 0.00, 32.50, 682.50, 'Pending', NULL, NULL, '2026-10-18'
WHERE NOT EXISTS (SELECT 1 FROM bills WHERE patient_id = @pat_suresh_id AND appointment_id = @apt_suresh_genmed1_id AND created_at = '2026-10-18');

SET @bill_suresh_id = (SELECT id FROM bills WHERE patient_id = @pat_suresh_id AND appointment_id = @apt_suresh_genmed1_id AND created_at = '2026-10-18');

INSERT INTO bill_items (bill_id, item_name, amount, quantity)
SELECT @bill_suresh_id, 'General Outpatient Consultation - Dr. Vikram Patel (General Medicine)', 650.00, 1
WHERE NOT EXISTS (SELECT 1 FROM bill_items WHERE bill_id = @bill_suresh_id AND item_name LIKE '%General Outpatient Consultation%');

-- -----------------------------------------------------------------------------
-- 15. Seed Consultation Chat Messages
-- -----------------------------------------------------------------------------
INSERT INTO chat_messages (sender_id, receiver_id, message)
SELECT @user_mehta_id, @user_amit_id, 'Good day Amit, please remember to keep track of your morning blood pressure readings before our follow-up visit. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE sender_id = @user_mehta_id AND receiver_id = @user_amit_id AND message LIKE 'Good day Amit%');

INSERT INTO chat_messages (sender_id, receiver_id, message)
SELECT @user_amit_id, @user_mehta_id, 'Thank you Dr. Mehta, the readings have been stable around 130/84 mmHg over the last four days. [FICTIONAL DEMO DATA — NOT FOR CLINICAL USE]'
WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE sender_id = @user_amit_id AND receiver_id = @user_mehta_id AND message LIKE 'Thank you Dr. Mehta%');

SELECT 'Faculty Demo Dataset seeded successfully!' AS status;

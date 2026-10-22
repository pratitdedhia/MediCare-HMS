-- =============================================================================
-- MediCare HMS - Narrowly Scoped Faculty Demo Dataset Rollback
-- =============================================================================
-- NOTICE: This script strictly removes ONLY the demo records generated for the
-- faculty demo dataset (identified by 'demo.faculty.*@medicare.com').
--
-- Safety Guarantees:
-- 1. Strictly Scoped: Never touches baseline users or unrelated clinical rows.
-- 2. FK-Safe Order: Deletes in reverse dependency order.
-- 3. Idempotent: Can be run multiple times safely.
-- =============================================================================

USE medicare_hms;

-- Step 1: Create a temporary table of target demo user IDs to ensure strict scoping
DROP TEMPORARY TABLE IF EXISTS tmp_demo_users;
CREATE TEMPORARY TABLE tmp_demo_users AS
SELECT id FROM users WHERE email LIKE 'demo.faculty.%@medicare.com';

-- Step 2: Temporary table of demo doctor IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_doctors;
CREATE TEMPORARY TABLE tmp_demo_doctors AS
SELECT id FROM doctors WHERE user_id IN (SELECT id FROM tmp_demo_users);

-- Step 3: Temporary table of demo patient IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_patients;
CREATE TEMPORARY TABLE tmp_demo_patients AS
SELECT id FROM patients WHERE user_id IN (SELECT id FROM tmp_demo_users);

-- Step 4: Temporary table of demo appointment IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_appointments;
CREATE TEMPORARY TABLE tmp_demo_appointments AS
SELECT id FROM appointments 
WHERE patient_id IN (SELECT id FROM tmp_demo_patients) 
   OR doctor_id IN (SELECT id FROM tmp_demo_doctors);

-- Step 5: Temporary table of demo medical record IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_records;
CREATE TEMPORARY TABLE tmp_demo_records AS
SELECT id FROM medical_records 
WHERE appointment_id IN (SELECT id FROM tmp_demo_appointments)
   OR patient_id IN (SELECT id FROM tmp_demo_patients);

-- Step 6: Temporary table of demo prescription IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_prescriptions;
CREATE TEMPORARY TABLE tmp_demo_prescriptions AS
SELECT id FROM prescriptions 
WHERE medical_record_id IN (SELECT id FROM tmp_demo_records);

-- Step 7: Temporary table of demo lab request IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_lab_requests;
CREATE TEMPORARY TABLE tmp_demo_lab_requests AS
SELECT id FROM lab_requests 
WHERE patient_id IN (SELECT id FROM tmp_demo_patients)
   OR doctor_id IN (SELECT id FROM tmp_demo_doctors);

-- Step 8: Temporary table of demo bill IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_bills;
CREATE TEMPORARY TABLE tmp_demo_bills AS
SELECT id FROM bills 
WHERE patient_id IN (SELECT id FROM tmp_demo_patients)
   OR appointment_id IN (SELECT id FROM tmp_demo_appointments);

-- Step 9: Temporary table of demo patient document IDs
DROP TEMPORARY TABLE IF EXISTS tmp_demo_documents;
CREATE TEMPORARY TABLE tmp_demo_documents AS
SELECT id FROM patient_documents 
WHERE patient_id IN (SELECT id FROM tmp_demo_patients);

-- =============================================================================
-- DELETE IN STRICT REVERSE FOREIGN-KEY ORDER
-- =============================================================================

-- 1. Chat Messages
DELETE FROM chat_messages 
WHERE sender_id IN (SELECT id FROM tmp_demo_users) 
   OR receiver_id IN (SELECT id FROM tmp_demo_users);

-- 2. Appointment Shared Records
DELETE FROM appointment_shared_records 
WHERE appointment_id IN (SELECT id FROM tmp_demo_appointments)
   OR patient_id IN (SELECT id FROM tmp_demo_patients)
   OR document_id IN (SELECT id FROM tmp_demo_documents);

-- 3. Patient Documents
DELETE FROM patient_documents 
WHERE id IN (SELECT id FROM tmp_demo_documents);

-- 4. Insurance Policies
DELETE FROM insurance_policies 
WHERE patient_id IN (SELECT id FROM tmp_demo_patients);

-- 5. Patient Illnesses
DELETE FROM patient_illnesses 
WHERE patient_id IN (SELECT id FROM tmp_demo_patients);

-- 6. Payments
DELETE FROM payments 
WHERE bill_id IN (SELECT id FROM tmp_demo_bills);

-- 7. Bill Items
DELETE FROM bill_items 
WHERE bill_id IN (SELECT id FROM tmp_demo_bills);

-- 8. Bills
DELETE FROM bills 
WHERE id IN (SELECT id FROM tmp_demo_bills);

-- 9. Lab Reports
DELETE FROM lab_reports 
WHERE lab_request_id IN (SELECT id FROM tmp_demo_lab_requests);

-- 10. Lab Requests
DELETE FROM lab_requests 
WHERE id IN (SELECT id FROM tmp_demo_lab_requests);

-- 11. Prescription Items
DELETE FROM prescription_items 
WHERE prescription_id IN (SELECT id FROM tmp_demo_prescriptions);

-- 12. Prescriptions
DELETE FROM prescriptions 
WHERE id IN (SELECT id FROM tmp_demo_prescriptions);

-- 13. Medical Records
DELETE FROM medical_records 
WHERE id IN (SELECT id FROM tmp_demo_records);

-- 14. Appointments
DELETE FROM appointments 
WHERE id IN (SELECT id FROM tmp_demo_appointments);

-- 15. Doctors
DELETE FROM doctors 
WHERE id IN (SELECT id FROM tmp_demo_doctors);

-- 16. Patients
DELETE FROM patients 
WHERE id IN (SELECT id FROM tmp_demo_patients);

-- 17. Users
DELETE FROM users 
WHERE id IN (SELECT id FROM tmp_demo_users);

-- Clean up temporary tables
DROP TEMPORARY TABLE IF EXISTS tmp_demo_documents;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_bills;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_lab_requests;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_prescriptions;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_records;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_appointments;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_patients;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_doctors;
DROP TEMPORARY TABLE IF EXISTS tmp_demo_users;

SELECT 'Faculty Demo Dataset rollback executed successfully. All demo records removed.' AS status;

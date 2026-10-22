/**
 * Faculty Demo Dataset Rollback Script for MediCare HMS
 * 
 * Safety & Design Principles:
 * - Narrowly scoped: Removes ONLY records belonging to demo accounts with 'demo.faculty.*@medicare.com'.
 * - Safe foreign-key order: Reverse dependency teardown.
 * - Idempotent: Can be run multiple times safely.
 * - Preserves ALL existing baseline users, doctors, patients, and operational data.
 */

import pool from '../config/db.js';

export async function rollbackFacultyDemo() {
    const connection = await pool.getConnection();
    console.log('------------------------------------------------------------');
    console.log('🧹 Starting Narrowly Scoped Faculty Demo Dataset Rollback...');
    console.log('------------------------------------------------------------');

    try {
        await connection.beginTransaction();

        // 1. Identify Demo Users by strict email pattern
        const [demoUsers] = await connection.query(
            "SELECT id, full_name, email FROM users WHERE email LIKE 'demo.faculty.%@medicare.com'"
        );

        if (demoUsers.length === 0) {
            console.log('ℹ️ No faculty demo records found in database. Nothing to roll back.');
            await connection.rollback();
            return;
        }

        const demoUserIds = demoUsers.map(u => u.id);
        console.log(`Found ${demoUsers.length} faculty demo accounts to roll back:`);
        demoUsers.forEach(u => console.log(` - ID ${u.id}: ${u.full_name} (${u.email})`));

        // 2. Identify Demo Doctors
        const [demoDocs] = await connection.query(
            'SELECT id FROM doctors WHERE user_id IN (?)',
            [demoUserIds]
        );
        const demoDoctorIds = demoDocs.map(d => d.id);

        // 3. Identify Demo Patients
        const [demoPats] = await connection.query(
            'SELECT id FROM patients WHERE user_id IN (?)',
            [demoUserIds]
        );
        const demoPatientIds = demoPats.map(p => p.id);

        // 4. Identify Demo Appointments
        let demoAppointmentIds = [];
        if (demoPatientIds.length > 0 || demoDoctorIds.length > 0) {
            const [demoApts] = await connection.query(
                'SELECT id FROM appointments WHERE patient_id IN (?) OR doctor_id IN (?)',
                [demoPatientIds.length ? demoPatientIds : [-1], demoDoctorIds.length ? demoDoctorIds : [-1]]
            );
            demoAppointmentIds = demoApts.map(a => a.id);
        }

        // 5. Identify Demo Medical Records
        let demoMrIds = [];
        if (demoAppointmentIds.length > 0 || demoPatientIds.length > 0) {
            const [demoMrs] = await connection.query(
                'SELECT id FROM medical_records WHERE appointment_id IN (?) OR patient_id IN (?)',
                [demoAppointmentIds.length ? demoAppointmentIds : [-1], demoPatientIds.length ? demoPatientIds : [-1]]
            );
            demoMrIds = demoMrs.map(m => m.id);
        }

        // 6. Identify Demo Prescriptions
        let demoPrescIds = [];
        if (demoMrIds.length > 0) {
            const [demoPrescs] = await connection.query(
                'SELECT id FROM prescriptions WHERE medical_record_id IN (?)',
                [demoMrIds]
            );
            demoPrescIds = demoPrescs.map(p => p.id);
        }

        // 7. Identify Demo Lab Requests
        let demoLabReqIds = [];
        if (demoPatientIds.length > 0 || demoDoctorIds.length > 0) {
            const [demoLabs] = await connection.query(
                'SELECT id FROM lab_requests WHERE patient_id IN (?) OR doctor_id IN (?)',
                [demoPatientIds.length ? demoPatientIds : [-1], demoDoctorIds.length ? demoDoctorIds : [-1]]
            );
            demoLabReqIds = demoLabs.map(l => l.id);
        }

        // 8. Identify Demo Bills
        let demoBillIds = [];
        if (demoPatientIds.length > 0 || demoAppointmentIds.length > 0) {
            const [demoBills] = await connection.query(
                'SELECT id FROM bills WHERE patient_id IN (?) OR appointment_id IN (?)',
                [demoPatientIds.length ? demoPatientIds : [-1], demoAppointmentIds.length ? demoAppointmentIds : [-1]]
            );
            demoBillIds = demoBills.map(b => b.id);
        }

        // 9. Identify Demo Patient Documents
        let demoDocIds = [];
        if (demoPatientIds.length > 0) {
            const [demoDocsList] = await connection.query(
                'SELECT id FROM patient_documents WHERE patient_id IN (?)',
                [demoPatientIds]
            );
            demoDocIds = demoDocsList.map(d => d.id);
        }

        console.log('\n🗑️ Deleting child records in safe foreign-key order...');

        // Step 1: Chat Messages
        const [delChat] = await connection.query(
            'DELETE FROM chat_messages WHERE sender_id IN (?) OR receiver_id IN (?)',
            [demoUserIds, demoUserIds]
        );
        console.log(`  - Deleted ${delChat.affectedRows} chat messages`);

        // Step 2: Appointment Shared Records
        if (demoAppointmentIds.length > 0 || demoPatientIds.length > 0 || demoDocIds.length > 0) {
            const [delShared] = await connection.query(
                'DELETE FROM appointment_shared_records WHERE appointment_id IN (?) OR patient_id IN (?) OR document_id IN (?)',
                [
                    demoAppointmentIds.length ? demoAppointmentIds : [-1],
                    demoPatientIds.length ? demoPatientIds : [-1],
                    demoDocIds.length ? demoDocIds : [-1]
                ]
            );
            console.log(`  - Deleted ${delShared.affectedRows} appointment shared record links`);
        }

        // Step 3: Patient Documents
        if (demoPatientIds.length > 0) {
            const [delDocs] = await connection.query(
                'DELETE FROM patient_documents WHERE patient_id IN (?)',
                [demoPatientIds]
            );
            console.log(`  - Deleted ${delDocs.affectedRows} patient documents`);
        }

        // Step 4: Insurance Policies
        if (demoPatientIds.length > 0) {
            const [delIns] = await connection.query(
                'DELETE FROM insurance_policies WHERE patient_id IN (?)',
                [demoPatientIds]
            );
            console.log(`  - Deleted ${delIns.affectedRows} insurance policies`);
        }

        // Step 5: Patient Illnesses
        if (demoPatientIds.length > 0) {
            const [delIll] = await connection.query(
                'DELETE FROM patient_illnesses WHERE patient_id IN (?)',
                [demoPatientIds]
            );
            console.log(`  - Deleted ${delIll.affectedRows} patient illnesses`);
        }

        // Step 6: Payments
        if (demoBillIds.length > 0) {
            const [delPay] = await connection.query(
                'DELETE FROM payments WHERE bill_id IN (?)',
                [demoBillIds]
            );
            console.log(`  - Deleted ${delPay.affectedRows} payments`);
        }

        // Step 7: Bill Items
        if (demoBillIds.length > 0) {
            const [delItems] = await connection.query(
                'DELETE FROM bill_items WHERE bill_id IN (?)',
                [demoBillIds]
            );
            console.log(`  - Deleted ${delItems.affectedRows} bill items`);
        }

        // Step 8: Bills
        if (demoBillIds.length > 0) {
            const [delBills] = await connection.query(
                'DELETE FROM bills WHERE id IN (?)',
                [demoBillIds]
            );
            console.log(`  - Deleted ${delBills.affectedRows} bills`);
        }

        // Step 9: Lab Reports
        if (demoLabReqIds.length > 0) {
            const [delReports] = await connection.query(
                'DELETE FROM lab_reports WHERE lab_request_id IN (?)',
                [demoLabReqIds]
            );
            console.log(`  - Deleted ${delReports.affectedRows} lab reports`);
        }

        // Step 10: Lab Requests
        if (demoLabReqIds.length > 0) {
            const [delReqs] = await connection.query(
                'DELETE FROM lab_requests WHERE id IN (?)',
                [demoLabReqIds]
            );
            console.log(`  - Deleted ${delReqs.affectedRows} lab requests`);
        }

        // Step 11: Prescription Items
        if (demoPrescIds.length > 0) {
            const [delPrescItems] = await connection.query(
                'DELETE FROM prescription_items WHERE prescription_id IN (?)',
                [demoPrescIds]
            );
            console.log(`  - Deleted ${delPrescItems.affectedRows} prescription items`);
        }

        // Step 12: Prescriptions
        if (demoPrescIds.length > 0) {
            const [delPrescs] = await connection.query(
                'DELETE FROM prescriptions WHERE id IN (?)',
                [demoPrescIds]
            );
            console.log(`  - Deleted ${delPrescs.affectedRows} prescriptions`);
        }

        // Step 13: Medical Records
        if (demoMrIds.length > 0) {
            const [delMrs] = await connection.query(
                'DELETE FROM medical_records WHERE id IN (?)',
                [demoMrIds]
            );
            console.log(`  - Deleted ${delMrs.affectedRows} medical records`);
        }

        // Step 14: Appointments
        if (demoAppointmentIds.length > 0) {
            const [delApts] = await connection.query(
                'DELETE FROM appointments WHERE id IN (?)',
                [demoAppointmentIds]
            );
            console.log(`  - Deleted ${delApts.affectedRows} appointments`);
        }

        // Step 15: Doctors
        if (demoDoctorIds.length > 0) {
            const [delDocsProfile] = await connection.query(
                'DELETE FROM doctors WHERE id IN (?)',
                [demoDoctorIds]
            );
            console.log(`  - Deleted ${delDocsProfile.affectedRows} doctor profiles`);
        }

        // Step 16: Patients
        if (demoPatientIds.length > 0) {
            const [delPatsProfile] = await connection.query(
                'DELETE FROM patients WHERE id IN (?)',
                [demoPatientIds]
            );
            console.log(`  - Deleted ${delPatsProfile.affectedRows} patient profiles`);
        }

        // Step 17: Users
        const [delUsers] = await connection.query(
            'DELETE FROM users WHERE id IN (?)',
            [demoUserIds]
        );
        console.log(`  - Deleted ${delUsers.affectedRows} demo users`);

        await connection.commit();
        console.log('------------------------------------------------------------');
        console.log('✨ Faculty demo dataset rollback completed successfully!');
        console.log('✨ Only scoped demo records were removed. All baseline data preserved.');
        console.log('------------------------------------------------------------');

    } catch (err) {
        await connection.rollback();
        console.error('❌ Rollback failed with error, aborted transaction:', err);
        throw err;
    } finally {
        connection.release();
    }
}

// Execute directly if run as a script
if (process.argv[1] && process.argv[1].endsWith('rollback_faculty_demo.js')) {
    rollbackFacultyDemo()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

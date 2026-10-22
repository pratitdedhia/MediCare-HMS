// Verification test script for Most Visited Doctor and Recently Visited Doctor indicators
import assert from 'assert';

console.log('--- Starting Doctor Indicators Verification Suite ---');

// Helper to simulate the frontend calculation logic
function calculateIndicators(appointments, patientId, doctors, users, departments) {
    const completedApts = (appointments || []).filter(a => a && a.patient_id === patientId && a.status === 'Completed');

    const docStatsMap = {};
    completedApts.forEach(apt => {
        if (!apt.doctor_id) return;
        if (!docStatsMap[apt.doctor_id]) {
            docStatsMap[apt.doctor_id] = {
                doctorId: apt.doctor_id,
                count: 0,
                latestDate: apt.appointment_date || '',
                latestTime: apt.appointment_time || ''
            };
        }
        docStatsMap[apt.doctor_id].count += 1;
        const curDate = apt.appointment_date || '';
        if (curDate > docStatsMap[apt.doctor_id].latestDate) {
            docStatsMap[apt.doctor_id].latestDate = curDate;
            docStatsMap[apt.doctor_id].latestTime = apt.appointment_time || '';
        } else if (curDate === docStatsMap[apt.doctor_id].latestDate) {
            if ((apt.appointment_time || '') > docStatsMap[apt.doctor_id].latestTime) {
                docStatsMap[apt.doctor_id].latestTime = apt.appointment_time || '';
            }
        }
    });

    const sortedByVisits = Object.values(docStatsMap).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const dateComp = (b.latestDate || '').localeCompare(a.latestDate || '');
        if (dateComp !== 0) return dateComp;
        return a.doctorId - b.doctorId;
    });

    let mostVisitedDoctor = null;
    if (sortedByVisits.length > 0) {
        const top = sortedByVisits[0];
        const doc = (doctors || []).find(d => d.id === top.doctorId);
        const user = doc ? (users || []).find(u => u.id === doc.user_id) : null;
        const dept = doc ? (departments || []).find(d => d.id === doc.department_id) : null;
        mostVisitedDoctor = {
            doctorId: top.doctorId,
            name: user?.full_name || 'Dr. Specialist',
            specialization: doc?.specialization || 'Consultant Physician',
            department: dept?.name || 'General Medicine',
            count: top.count,
            lastDate: top.latestDate
        };
    }

    let recentlyVisitedDoctor = null;
    if (completedApts.length > 0) {
        const sortedCompleted = [...completedApts].sort((a, b) => {
            const dateA = a.appointment_date || '';
            const dateB = b.appointment_date || '';
            if (dateB !== dateA) return dateB.localeCompare(dateA);
            const timeA = a.appointment_time || '';
            const timeB = b.appointment_time || '';
            if (timeB !== timeA) return timeB.localeCompare(timeA);
            return (b.id || 0) - (a.id || 0);
        });

        const recentApt = sortedCompleted[0];
        const doc = (doctors || []).find(d => d.id === recentApt.doctor_id);
        const user = doc ? (users || []).find(u => u.id === doc.user_id) : null;
        const dept = doc ? (departments || []).find(d => d.id === doc.department_id) : null;
        const stat = docStatsMap[recentApt.doctor_id];
        recentlyVisitedDoctor = {
            doctorId: recentApt.doctor_id,
            name: user?.full_name || 'Dr. Specialist',
            specialization: doc?.specialization || 'Consultant Physician',
            department: dept?.name || 'General Medicine',
            count: stat ? stat.count : 1,
            lastDate: recentApt.appointment_date || 'N/A',
            lastTime: recentApt.appointment_time || ''
        };
    }

    return { mostVisitedDoctor, recentlyVisitedDoctor, totalCompleted: completedApts.length };
}

// Mock doctors and departments
const mockUsers = [
    { id: 2, full_name: 'Dr. Sarah Jenkins' },
    { id: 8, full_name: 'Dr. Ramesh Nair' },
    { id: 9, full_name: 'Dr. Ananya Sharma' }
];

const mockDoctors = [
    { id: 1, user_id: 2, department_id: 1, specialization: 'Interventional Cardiology' },
    { id: 2, user_id: 8, department_id: 5, specialization: 'Internal Medicine' },
    { id: 3, user_id: 9, department_id: 2, specialization: 'Neurology' }
];

const mockDepartments = [
    { id: 1, name: 'Cardiology' },
    { id: 2, name: 'Neurology' },
    { id: 5, name: 'General Medicine' }
];

// Test Case 1: Multiple Completed Visits
console.log('\n--- Test Case 1: Multiple Completed Visits ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-07-28', appointment_time: '10:00 AM' },
        { id: 4, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-09-12', appointment_time: '11:30 AM' },
        { id: 5, patient_id: 1, doctor_id: 2, status: 'Completed', appointment_date: '2026-08-15', appointment_time: '03:00 PM' }
    ];
    const res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    console.log('Most Visited:', res.mostVisitedDoctor);
    console.log('Recently Visited:', res.recentlyVisitedDoctor);

    assert.strictEqual(res.mostVisitedDoctor.doctorId, 1, 'Most visited should be Dr. Sarah Jenkins (doctor_id 1)');
    assert.strictEqual(res.mostVisitedDoctor.count, 2, 'Most visited count should be 2');
    assert.strictEqual(res.recentlyVisitedDoctor.doctorId, 1, 'Recently visited should be doctor_id 1 (date 2026-09-12)');
    assert.strictEqual(res.recentlyVisitedDoctor.lastDate, '2026-09-12');
    console.log('✅ Test Case 1 Passed');
}

// Test Case 2: Non-completed Appointments are Excluded
console.log('\n--- Test Case 2: Non-completed appointments excluded (Scheduled, Proposed, Cancelled) ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-07-28' },
        { id: 2, patient_id: 1, doctor_id: 2, status: 'Scheduled', appointment_date: '2026-10-25' },
        { id: 3, patient_id: 1, doctor_id: 2, status: 'Proposed', appointment_date: '2026-11-02' },
        { id: 4, patient_id: 1, doctor_id: 2, status: 'Cancelled', appointment_date: '2026-10-01' }
    ];
    const res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res.mostVisitedDoctor.doctorId, 1, 'Only completed visits count');
    assert.strictEqual(res.mostVisitedDoctor.count, 1, 'Visit count should be 1');
    assert.strictEqual(res.recentlyVisitedDoctor.doctorId, 1, 'Recently visited doctor should be doctor_id 1');
    assert.strictEqual(res.totalCompleted, 1, 'Total completed should be 1');
    console.log('✅ Test Case 2 Passed');
}

// Test Case 3: Tied Visit Counts
console.log('\n--- Test Case 3: Tied Visit Counts (More recent visit wins) ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-07-28' },
        { id: 2, patient_id: 1, doctor_id: 2, status: 'Completed', appointment_date: '2026-08-15' }
    ];
    // Both doctors have 1 visit, but Doctor 2 was visited on 2026-08-15 > 2026-07-28
    const res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res.mostVisitedDoctor.doctorId, 2, 'Doctor 2 should win tie due to more recent date 2026-08-15');
    assert.strictEqual(res.mostVisitedDoctor.count, 1);
    assert.strictEqual(res.recentlyVisitedDoctor.doctorId, 2);
    console.log('✅ Test Case 3 Passed');
}

// Test Case 4: No Completed Visits
console.log('\n--- Test Case 4: No Completed Visits (Graceful empty state) ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 1, status: 'Scheduled', appointment_date: '2026-10-28' },
        { id: 2, patient_id: 1, doctor_id: 2, status: 'Cancelled', appointment_date: '2026-09-01' }
    ];
    const res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res.mostVisitedDoctor, null, 'Most visited doctor should be null');
    assert.strictEqual(res.recentlyVisitedDoctor, null, 'Recently visited doctor should be null');
    assert.strictEqual(res.totalCompleted, 0);
    console.log('✅ Test Case 4 Passed');
}

// Test Case 5: Newly Completed Visit Updates Indicators
console.log('\n--- Test Case 5: Newly Completed Visit Updates Indicators Dynamically ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-07-28' },
        { id: 2, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-09-12' },
        { id: 3, patient_id: 1, doctor_id: 2, status: 'Completed', appointment_date: '2026-08-15' },
        { id: 4, patient_id: 1, doctor_id: 3, status: 'Scheduled', appointment_date: '2026-10-22' }
    ];
    let res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res.mostVisitedDoctor.doctorId, 1);
    assert.strictEqual(res.recentlyVisitedDoctor.doctorId, 1);

    // Doctor 3 consultation completed today!
    appointments[3].status = 'Completed';
    res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    console.log('After completing appointment 4:', res.recentlyVisitedDoctor);
    assert.strictEqual(res.recentlyVisitedDoctor.doctorId, 3, 'Recently visited doctor should now be doctor 3');
    assert.strictEqual(res.recentlyVisitedDoctor.lastDate, '2026-10-22');
    assert.strictEqual(res.mostVisitedDoctor.doctorId, 1, 'Most visited should still be doctor 1 with 2 visits');
    console.log('✅ Test Case 5 Passed');
}

// Test Case 6: Patient Scoping & Data Leakage Prevention
console.log('\n--- Test Case 6: Patient Scoping (No cross-patient leakage) ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 1, status: 'Completed', appointment_date: '2026-07-28' },
        { id: 2, patient_id: 2, doctor_id: 3, status: 'Completed', appointment_date: '2026-10-20' },
        { id: 3, patient_id: 2, doctor_id: 3, status: 'Completed', appointment_date: '2026-10-21' }
    ];
    // Patient 1 calculation
    const res1 = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res1.mostVisitedDoctor.doctorId, 1);
    assert.strictEqual(res1.mostVisitedDoctor.count, 1);
    assert.strictEqual(res1.recentlyVisitedDoctor.doctorId, 1);

    // Patient 2 calculation
    const res2 = calculateIndicators(appointments, 2, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res2.mostVisitedDoctor.doctorId, 3);
    assert.strictEqual(res2.mostVisitedDoctor.count, 2);
    assert.strictEqual(res2.recentlyVisitedDoctor.doctorId, 3);
    console.log('✅ Test Case 6 Passed');
}

// Test Case 7: Missing Doctor Profile / Corrupted Record Handled Gracefully
console.log('\n--- Test Case 7: Missing Doctor Profile Handled Gracefully ---');
{
    const appointments = [
        { id: 1, patient_id: 1, doctor_id: 999, status: 'Completed', appointment_date: '2026-07-28' }
    ];
    const res = calculateIndicators(appointments, 1, mockDoctors, mockUsers, mockDepartments);
    assert.strictEqual(res.mostVisitedDoctor.doctorId, 999);
    assert.strictEqual(res.mostVisitedDoctor.name, 'Dr. Specialist');
    assert.strictEqual(res.recentlyVisitedDoctor.doctorId, 999);
    console.log('✅ Test Case 7 Passed');
}

console.log('\nALL 7 VERIFICATION CASES PASSED SUCCESSFULLY! 🎉');

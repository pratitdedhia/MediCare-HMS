import fs from 'fs';
import assert from 'assert';

console.log('=== VERIFYING DOCTOR SHARED MEDICAL RECORDS INCONSISTENCY FIX ===\n');

const html = fs.readFileSync('index.html', 'utf8');

// Set up mock DOM and localStorage environment
const elements = {};
function getEl(id) {
    if (!elements[id]) {
        elements[id] = { id, innerHTML: '', style: {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } };
    }
    return elements[id];
}

const localStorageData = {};
global.localStorage = {
    getItem: (k) => localStorageData[k] || null,
    setItem: (k, v) => { localStorageData[k] = v; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};
global.document = {
    getElementById: getEl,
    createElement: () => ({ setAttribute: () => {}, classList: { add: () => {} } }),
    querySelectorAll: () => []
};
global.window = {};
global.lucide = { createIcons: () => {} };

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Could not find script tag in index.html');

// Execute script from index.html in global scope
(0, eval)(scriptMatch[1]);

// Test 1: Helper function getAppointmentSharedRecords
console.log('--- Test 1: Testing getAppointmentSharedRecords helper function ---');
const db = getDB();
assert(typeof getAppointmentSharedRecords === 'function', 'getAppointmentSharedRecords should be defined');

const apt2 = db.appointments.find(a => a.id === 2);
assert(apt2, 'Appointment #2 should exist');
const sharedApt2 = getAppointmentSharedRecords(apt2, db);

assert.strictEqual(sharedApt2.count, 4, `Apt #2 shared count must be 4, got: ${sharedApt2.count}`);
assert.strictEqual(sharedApt2.reports.length, 2, 'Apt #2 must have 2 reports');
assert.strictEqual(sharedApt2.prescriptions.length, 2, 'Apt #2 must have 2 prescriptions/documents');
assert.strictEqual(sharedApt2.hasConsent, true, 'Apt #2 hasConsent must be true');

// Verify titles and types
assert(sharedApt2.reports.some(r => r.title.includes('Complete Blood Count')), 'Should contain CBC Report');
assert(sharedApt2.reports.some(r => r.title.includes('Thyroid Function Test')), 'Should contain Thyroid Test');
assert(sharedApt2.prescriptions.some(p => p.title.includes('Dr. Sarah Jenkins')), 'Should contain Jenkins Prescription');
assert(sharedApt2.prescriptions.some(p => p.title.includes('Consultation Summary')), 'Should contain Consultation Summary');
console.log('✅ Test 1 Passed: getAppointmentSharedRecords resolves 4 records correctly for Apt #2.');

// Test 2: Appointment with no shared records (Apt #3)
console.log('--- Test 2: Testing appointment with no shared records (Apt #3) ---');
const apt3 = db.appointments.find(a => a.id === 3);
assert(apt3, 'Appointment #3 should exist');
const sharedApt3 = getAppointmentSharedRecords(apt3, db);

assert.strictEqual(sharedApt3.count, 0, `Apt #3 shared count must be 0, got: ${sharedApt3.count}`);
assert.strictEqual(sharedApt3.reports.length, 0, 'Apt #3 must have 0 reports');
assert.strictEqual(sharedApt3.prescriptions.length, 0, 'Apt #3 must have 0 prescriptions');
assert.strictEqual(sharedApt3.hasConsent, false, 'Apt #3 hasConsent must be false');
console.log('✅ Test 2 Passed: getAppointmentSharedRecords returns count 0 and empty arrays for Apt #3.');

// Test 3: Edge Cases - Consent false with non-empty IDs, Consent true with empty IDs, Cross-patient filtering
console.log('--- Test 3: Edge Cases and Security Scoping ---');
// Subcase A: Consent false with IDs
const fakeAptNoConsent = {
    id: 901,
    patient_id: 1,
    doctor_id: 1,
    record_sharing_consent: false,
    shared_report_ids: [1, 2],
    shared_prescription_ids: [5]
};
const resNoConsent = getAppointmentSharedRecords(fakeAptNoConsent, db);
assert.strictEqual(resNoConsent.count, 0, 'Count must be 0 when record_sharing_consent is false');
assert.strictEqual(resNoConsent.reports.length, 0, 'Reports must be empty when record_sharing_consent is false');

// Subcase B: Consent true with empty arrays
const fakeAptEmptyShared = {
    id: 902,
    patient_id: 1,
    doctor_id: 1,
    record_sharing_consent: true,
    shared_report_ids: [],
    shared_prescription_ids: []
};
const resEmptyShared = getAppointmentSharedRecords(fakeAptEmptyShared, db);
assert.strictEqual(resEmptyShared.count, 0, 'Count must be 0 when arrays are empty');

// Subcase C: Cross-patient data isolation
// Add a document belonging to Patient 999
db.patient_documents.push({
    id: 777,
    patient_id: 999,
    title: 'Secret Document of Patient 999',
    category: 'Report',
    document_type: 'Private Report'
});
// Malicious appointment for Patient 1 trying to reference Patient 999's document #777
const fakeAptSpoofed = {
    id: 903,
    patient_id: 1,
    doctor_id: 1,
    record_sharing_consent: true,
    shared_report_ids: [777],
    shared_prescription_ids: []
};
const resSpoofed = getAppointmentSharedRecords(fakeAptSpoofed, db);
assert.strictEqual(resSpoofed.count, 0, 'Must NOT include documents belonging to another patient');
assert.strictEqual(resSpoofed.reports.length, 0, 'Reports must NOT include documents belonging to another patient');
console.log('✅ Test 3 Passed: Edge cases and cross-patient isolation verified.');

// Test 4: Doctor OPD Consultation UI Render - Appointment with Shared Records (#2)
console.log('--- Test 4: Doctor OPD Consultation Render - Appointment #2 ---');
const doctorUser = db.users.find(u => u.email === 'doctor@medicare.com');
assert(doctorUser, 'Doctor user should exist');
loginSession(doctorUser);

window.doctorActiveConsultAptId = 2;
switchTab('consultation');

const container = getEl('main-content-view');
const consultHtml = container.innerHTML;

// Verify badge count matches exactly
assert(consultHtml.includes('Medical Records Shared: 4'), 'UI Badge MUST show "Medical Records Shared: 4"');
assert(!consultHtml.includes('No Records Shared'), 'UI Badge MUST NOT show "No Records Shared"');

// Verify empty state is NOT rendered
assert(!consultHtml.includes('The patient has not shared any medical records for this appointment.'), 'MUST NOT show empty state message for Appointment #2');

// Verify actual records are listed
assert(consultHtml.includes('Complete Blood Count (CBC) Report'), 'Must list CBC report');
assert(consultHtml.includes('Thyroid Function Test (T3, T4, TSH)'), 'Must list Thyroid report');
assert(consultHtml.includes('Prescription by Dr. Sarah Jenkins (Cardiology)'), 'Must list Prescription document');
assert(consultHtml.includes('Previous Consultation Summary &amp; Clinical Note') || consultHtml.includes('Previous Consultation Summary & Clinical Note'), 'Must list Consultation note');

// Verify category badges count
assert(consultHtml.includes('Shared Medical Reports &amp; Lab Tests</span>\n                                                <span class="badge bg-primary rounded-pill">2</span>') || consultHtml.includes('Shared Medical Reports & Lab Tests</span>\n                                                <span class="badge bg-primary rounded-pill">2</span>'), 'Must show 2 reports category badge');
assert(consultHtml.includes('Shared Prescriptions &amp; Documents</span>\n                                                <span class="badge bg-success rounded-pill">2</span>') || consultHtml.includes('Shared Prescriptions & Documents</span>\n                                                <span class="badge bg-success rounded-pill">2</span>'), 'Must show 2 prescriptions category badge');

// Verify Preview button action
assert(consultHtml.includes("onclick=\"previewMedicalDocument('1')\""), 'Must have working preview button for doc 1');
console.log('✅ Test 4 Passed: Appointment #2 shows badge "Medical Records Shared: 4" AND lists all 4 records with NO empty state message.');

// Test 5: Doctor OPD Consultation UI Render - Appointment with NO Shared Records (#3)
console.log('--- Test 5: Doctor OPD Consultation Render - Appointment #3 ---');
onConsultAppointmentChange(3);

const consultHtmlApt3 = container.innerHTML;
assert(consultHtmlApt3.includes('No Records Shared'), 'UI Badge MUST show "No Records Shared" for Apt #3');
assert(!consultHtmlApt3.includes('Medical Records Shared:'), 'UI Badge MUST NOT show "Medical Records Shared: X" for Apt #3');
assert(consultHtmlApt3.includes('The patient has not shared any medical records for this appointment.'), 'MUST show empty state message for Appointment #3');
assert(!consultHtmlApt3.includes('Complete Blood Count (CBC) Report'), 'MUST NOT list any documents for Apt #3');
console.log('✅ Test 5 Passed: Appointment #3 shows badge "No Records Shared" AND shows empty state message.');

// Test 6: Doctor Appointments Table Badge Check
console.log('--- Test 6: Doctor Appointments Table Row Badges ---');
switchTab('doctor-appointments');
const apptsHtml = container.innerHTML;
// Apt #2 row must show 4
assert(apptsHtml.includes('Medical Records Shared: 4'), 'Table row for Apt #2 must show Medical Records Shared: 4');
// Apt #3 row must show No Shared Records
assert(apptsHtml.includes('No Shared Records'), 'Table row for Apt #3 must show No Shared Records');
console.log('✅ Test 6 Passed: Appointments table displays synchronized shared records badges.');

// Test 7: Doctor Appointment Details Modal Check
console.log('--- Test 7: Doctor Appointment Details Modal ---');
openDoctorAppointmentDetailsModal(2);
const modalContentEl = getEl('dynamic-modal-box');
const modalApt2Html = modalContentEl.innerHTML;
assert(modalApt2Html.includes('Medical Records Shared: 4'), 'Modal for Apt #2 must show Medical Records Shared: 4');
assert(!modalApt2Html.includes('The patient has not shared any medical records for this appointment.'), 'Modal for Apt #2 must not show empty state');
assert(modalApt2Html.includes('Complete Blood Count (CBC) Report'), 'Modal for Apt #2 must list CBC Report');

openDoctorAppointmentDetailsModal(3);
const modalApt3Html = modalContentEl.innerHTML;
assert(modalApt3Html.includes('No Shared Records'), 'Modal for Apt #3 must show No Shared Records');
assert(modalApt3Html.includes('The patient has not shared any medical records for this appointment.'), 'Modal for Apt #3 must show empty state message');
assert(!modalApt3Html.includes('Complete Blood Count (CBC) Report'), 'Modal for Apt #3 must not list CBC Report');
console.log('✅ Test 7 Passed: Doctor Details Modal correctly synchronizes badge and record list for both appointments.');

console.log('\n======================================================');
console.log('🎉 ALL TESTS PASSED! ZERO INCONSISTENCIES FOUND.');
console.log('======================================================');

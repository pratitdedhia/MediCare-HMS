// Verification of index.html patient profile indicators render & dynamic behavior
import fs from 'fs';
import assert from 'assert';

const html = fs.readFileSync('index.html', 'utf8');

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
    setItem: (k, v) => { localStorageData[k] = v; }
};
global.document = {
    getElementById: getEl,
    createElement: () => ({ setAttribute: () => {}, classList: { add: () => {} } }),
    querySelectorAll: () => []
};
global.window = {};
global.lucide = { createIcons: () => {} };

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Could not find script in index.html');

// Execute index.html script in global context
(0, eval)(scriptMatch[1]);

console.log('--- Verifying index.html Patient Profile ---');

// 1. Initial State (John Doe has 2 completed visits with Dr. Sarah Jenkins, 1 with Dr. Ramesh Nair)
const db = getDB();
const patientUser = db.users.find(u => u.email === 'patient@medicare.com');
loginSession(patientUser);
switchTab('patient-profile');

const container = getEl('main-content-view');
assert(container.innerHTML.includes('Most Visited Doctor'), 'Should render Most Visited Doctor');
assert(container.innerHTML.includes('Recently Visited Doctor'), 'Should render Recently Visited Doctor');
assert(container.innerHTML.includes('id="most-visited-doc-name">Dr. Sarah Jenkins'), 'Most Visited should be Dr. Sarah Jenkins');
assert(container.innerHTML.includes('id="most-visited-count-badge">\n                                                2 Visits'), 'Dr. Sarah Jenkins should have 2 visits');
assert(container.innerHTML.includes('id="recent-visited-doc-name">Dr. Sarah Jenkins'), 'Recently Visited should be Dr. Sarah Jenkins (last completed visit was 2026-09-12)');
assert(container.innerHTML.includes('2026-09-12'), 'Should show last consult date 2026-09-12');
console.log('✅ Initial State Verified: Dr. Sarah Jenkins correctly identified with 2 visits.');

// 2. Dynamic Update & Tie-Breaking
// Add a completed visit for Dr. Ramesh Nair on 2026-10-22 (Doctor 2 now has 2 visits, latest date 2026-10-22)
db.appointments.push({
    id: 99,
    patient_id: 1,
    doctor_id: 2,
    department_id: 5,
    appointment_date: '2026-10-22',
    appointment_time: '04:00 PM',
    status: 'Completed'
});
saveDB(db);

renderContentView();

assert(container.innerHTML.includes('id="recent-visited-doc-name">Dr. Ramesh Nair'), 'Recently Visited should dynamically update to Dr. Ramesh Nair');
assert(container.innerHTML.includes('2026-10-22'), 'Recently Visited date should be 2026-10-22');
assert(container.innerHTML.includes('id="most-visited-doc-name">Dr. Ramesh Nair'), 'Dr. Ramesh Nair should win tie-break for Most Visited (more recent date 2026-10-22 vs 2026-09-12)');
console.log('✅ Dynamic Update & Tie-Break Verified: Dr. Ramesh Nair dynamically became recently visited and won tie.');

// 3. New Patient with Zero Visits
const newPatientUser = { id: 888, full_name: 'New Patient', email: 'newpatient@medicare.com', role: 'Patient' };
db.users.push(newPatientUser);
db.patients.push({ id: 999, user_id: 888, phone: '+91 99999 88888', medical_history: '' });
saveDB(db);

loginSession(newPatientUser);
switchTab('patient-profile');

assert(container.innerHTML.includes('No Completed Visits Yet'), 'Should show empty state for Most Visited Doctor');
assert(container.innerHTML.includes('No Recent Visits'), 'Should show empty state for Recently Visited Doctor');
assert(!container.innerHTML.includes('Dr. Sarah Jenkins'), 'Must NOT expose other patient doctor data');
assert(!container.innerHTML.includes('Dr. Ramesh Nair'), 'Must NOT expose other patient doctor data');
console.log('✅ Zero Visits & Patient Scoping Verified: Clean fallback empty states, zero cross-patient data exposure.');

console.log('\nALL INDEX.HTML RENDER CHECKS PASSED PERFECTLY! 🚀');

import fs from 'fs';
import assert from 'assert';

console.log('=== VERIFYING PATIENT APPOINTMENT BOOKING & PAYMENT FLOW ===\n');

const html = fs.readFileSync('index.html', 'utf8');

// Set up mock DOM and localStorage environment
const elements = {};
function getEl(id) {
    if (!elements[id]) {
        elements[id] = { 
            id, 
            innerHTML: '', 
            value: '',
            style: {}, 
            appendChild: () => {}, 
            classList: { 
                add: () => {}, 
                remove: () => {}, 
                toggle: () => {} 
            },
            getAttribute: (attr) => elements[id][attr] || null,
            setAttribute: (attr, val) => { elements[id][attr] = val; }
        };
    }
    return elements[id];
}

const localStorageData = {};
global.localStorage = {
    getItem: (k) => localStorageData[k] || null,
    setItem: (k, v) => { localStorageData[k] = v; },
    removeItem: (k) => { delete localStorageData[k]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};

global.document = {
    getElementById: getEl,
    createElement: (tag) => ({ 
        tagName: tag,
        setAttribute: () => {}, 
        classList: { add: () => {}, remove: () => {} },
        style: {},
        innerHTML: ''
    }),
    querySelectorAll: (sel) => {
        if (sel === '.slot-picker-btn') {
            return [{
                classList: { remove: () => {}, add: () => {} }
            }];
        }
        if (sel.includes('.booking-report-chk:checked') || sel.includes('.booking-presc-chk:checked')) {
            return [];
        }
        return [];
    },
    querySelector: (sel) => {
        if (sel === 'input[name="booking-share-consent"]:checked') {
            return { value: 'no' };
        }
        return null;
    }
};
global.window = {};
global.lucide = { createIcons: () => {} };
global.alert = (msg) => { console.log('   [ALERT DIALOG]:', msg); };

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Could not find script tag in index.html');

const processedScript = scriptMatch[1]
    .replace('let currentTab =', 'global.currentTab =')
    .replace('let currentRole =', 'global.currentRole =')
    .replace('let currentBookingStep =', 'global.currentBookingStep =')
    .replace('let selectedBookingSlot =', 'global.selectedBookingSlot =');

// Execute script from index.html in global scope
(0, eval)(processedScript);

console.log('--- Test 1: Patient Login State & Doctor Retrieval ---');
const db = getDB();
const patientUser = db.users.find(u => (u.role || '').toLowerCase() === 'patient');
assert(patientUser, 'Should have a patient user in default DB');

loginSession(patientUser);

const doctor = db.doctors[0];
assert(doctor, 'Should have a doctor in DB');
const docUser = db.users.find(u => u.id === doctor.user_id);
console.log(`✅ Logged in as: ${patientUser.full_name} (ID: ${patientUser.id})`);
console.log(`✅ Target Doctor: Dr. ${docUser.full_name} (${doctor.specialization})`);

console.log('\n--- Test 2: Trigger Doctor Booking Modal & Stepper Flow ---');
openDoctorBookingModal(doctor.id);
assert(currentBookingStep === 1, 'Current step should start at 1');

// Move to Step 2
goToBookingStep(2, doctor.id);
assert(currentBookingStep === 2, 'Current step should advance to 2');

const dateInput = getEl('booking-date-input');
assert(dateInput.value, 'Date input should be pre-populated on entering step 2');
console.log(`✅ Step 2 date pre-populated: ${dateInput.value}`);

// Select a slot
const mockBtn = { classList: { add: () => {}, remove: () => {} } };
selectBookingTimeSlot(mockBtn, '10:00 AM');
assert.strictEqual(selectedBookingSlot, '10:00 AM', 'selectedBookingSlot should be 10:00 AM');
console.log(`✅ Selected time slot: ${selectedBookingSlot}`);

// Advance via validateStep2AndProceed directly to Step 4
validateStep2AndProceed(doctor.id, 4);
assert.strictEqual(currentBookingStep, 4, 'Should be on Step 4 (Confirm Booking)');
console.log('✅ Stepper navigated directly to Step 4 Confirmation successfully');

console.log('\n--- Test 3: Execute Doctor Booking & Show Secure Payment Desk ---');
const initialAptCount = db.appointments.length;
const initialBillCount = db.bills.length;

// This call previously crashed with ReferenceError: freshDoctor is not defined!
executeDoctorBooking(doctor.id);

assert(window.currentPaymentDeskState, 'currentPaymentDeskState must be initialized');
assert.strictEqual(window.currentPaymentDeskState.amount, doctor.fee, `Payment amount must equal doctor fee ₹${doctor.fee}`);
assert(window.currentPaymentDeskState.extraMeta.doctorName, 'Payment desk should receive doctorName');
assert.strictEqual(window.currentPaymentDeskState.extraMeta.specialization, doctor.specialization, 'Payment desk should receive doctor specialization without ReferenceError');
assert(window.currentPaymentDeskState.extraMeta.dateTime.includes('10:00 AM'), 'Payment desk should have dateTime');
console.log('✅ Payment desk opened successfully without ReferenceError!');
console.log(`   Amount: ₹${window.currentPaymentDeskState.amount}`);
console.log(`   Doctor: ${window.currentPaymentDeskState.extraMeta.doctorName}`);
console.log(`   Specialization: ${window.currentPaymentDeskState.extraMeta.specialization}`);
console.log(`   Schedule: ${window.currentPaymentDeskState.extraMeta.dateTime}`);

console.log('\n--- Test 4: Complete Payment Desk Transaction ---');
// Set payment method to Card with valid Luhn test card
setPaymentDeskStep(2);
window.currentPaymentDeskState.selectedMethod = 'card';
window.currentPaymentDeskState.cardData = {
    name: patientUser.full_name,
    number: '4242 4242 4242 4242',
    expiry: '12/28',
    cvv: '123'
};

executePaymentDeskTransaction();

// Fast-forward processing timeout
assert.strictEqual(window.currentPaymentDeskState.isProcessing, true, 'Payment desk should show processing state');

// Wait for setTimeout to resolve in payment engine
await new Promise(r => setTimeout(r, 700));

const updatedDB = getDB();
assert.strictEqual(updatedDB.appointments.length, initialAptCount + 1, 'Appointments count should increment by 1');
assert.strictEqual(updatedDB.bills.length, initialBillCount + 1, 'Bills count should increment by 1');

const bookedApt = updatedDB.appointments[updatedDB.appointments.length - 1];
const bookedBill = updatedDB.bills[updatedDB.bills.length - 1];

assert.strictEqual(bookedApt.doctor_id, doctor.id, 'Booked appointment doctor_id matches');
assert.strictEqual(bookedApt.status, 'Scheduled', 'Appointment status is Scheduled');
assert.strictEqual(bookedApt.appointment_time, '10:00 AM', 'Appointment time is 10:00 AM');
assert.strictEqual(bookedBill.status, 'Paid', 'Bill status is Paid');
assert.strictEqual(bookedBill.total_amount, doctor.fee, 'Bill amount matches doctor fee');

console.log('✅ Appointment confirmed & stored in database:');
console.log(`   Appointment ID: #${bookedApt.id}, Token: ${bookedApt.token_number}, Status: ${bookedApt.status}`);
console.log(`   Bill ID: #${bookedBill.id}, Amount: ₹${bookedBill.net_amount}, Method: ${bookedBill.payment_method}`);

// Verify receipt screen in Payment Desk
assert.strictEqual(window.currentPaymentDeskState.step, 3, 'Payment Desk should transition to Step 3 (Receipt)');
assert(window.currentPaymentDeskState.receipt, 'Receipt object should be populated');
console.log(`✅ Official Receipt Generated: Ref ${window.currentPaymentDeskState.receipt.txnRef}`);

closePaymentDeskModal();
assert.strictEqual(window.currentPaymentDeskState, null, 'Payment desk state cleared upon closing');
assert.strictEqual(currentTab, 'dashboard', 'User directed to patient dashboard to view new booking');

console.log('\n🎉 ALL PATIENT BOOKING & PAYMENT FLOW VERIFICATION TESTS PASSED!');

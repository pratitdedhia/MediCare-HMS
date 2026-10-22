# MediCare HMS — Faculty Demo Dataset & Credentials Note

> **DISCLAIMER:**  
> **FICTIONAL DEMO DATA — NOT FOR CLINICAL USE.**  
> All names, phone numbers, addresses, diagnoses, and medical records in this dataset are entirely fictional Indian demo records crafted exclusively for academic demonstration and faculty evaluation. No real personal health information or clinical entities are represented.

---

## 1. Overview

This document provides credentials, architecture notes, and execution instructions for the optional, opt-in **Faculty Demo Dataset**.

### Key Design Principles:
- **Non-Destructive:** Does **not** edit, execute, or rely on `database/seed.sql`. Existing tables and records are 100% preserved.
- **Idempotent:** Safe to run repeatedly; uses existence checks (`WHERE NOT EXISTS` / `SELECT ... WHERE email = ...`) without creating duplicates.
- **Dynamic Linkages:** Foreign keys, role IDs, and department IDs are resolved at runtime rather than relying on fixed auto-increment IDs.
- **Isolated Namespace:** All accounts are isolated under the reserved email namespace `demo.faculty.*@medicare.com`.
- **Narrowly Scoped Rollback:** A dedicated rollback mechanism removes only the demo rows and metadata in reverse foreign-key order.

---

## 2. Demo User Accounts & Credentials

All demo accounts use the standard demo password hashed with `bcryptjs` (cost factor 10) matching the application's login flow.

- **Plaintext Password for All Demo Accounts:** `password123`
- **Stored Bcrypt Hash:** `$2a$10$U.w7eKqj0/qFqLd/tO8h/OGgBqU05p99Lg22aM3uO7eY.hP3l4u3C`

### Faculty Demo Doctors

| Full Name | Role | Login Email | Password | Department / Specialization | Consultation Fee | OPD Room |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dr. Rajesh Mehta** | Doctor | `demo.faculty.dr.mehta@medicare.com` | `password123` | Cardiology & Preventive Heart Care | ₹800.00 INR | Room 102 |
| **Dr. Sunita Rao** | Doctor | `demo.faculty.dr.rao@medicare.com` | `password123` | Neurology & Headache Management | ₹900.00 INR | Room 204 |
| **Dr. Vikram Patel** | Doctor | `demo.faculty.dr.patel@medicare.com` | `password123` | Internal Medicine & Chronic Disease Care | ₹650.00 INR | Room 105 |
| **Dr. Arvind Kulkarni** | Doctor | `demo.faculty.dr.kulkarni@medicare.com` | `password123` | Orthopedic Surgery & Joint Replacement | ₹950.00 INR | Room 201 |
| **Dr. Priya Swaminathan** | Doctor | `demo.faculty.dr.swaminathan@medicare.com` | `password123` | Pediatrics & Child Developmental Health | ₹700.00 INR | Room 108 |

### Faculty Demo Laboratory Staff

| Full Name | Role | Login Email | Password | Assigned Lab Shifts & Services |
| :--- | :--- | :--- | :--- | :--- |
| **Pooja Sharma** | Laboratory Staff | `demo.faculty.pooja.lab@medicare.com` | `password123` | Pathology, Biochemistry, Hematology (CBC, LFT, KFT, HbA1c) |
| **Arjun Verma** | Laboratory Staff | `demo.faculty.arjun.lab@medicare.com` | `password123` | Radiology, Ultrasonography, Specialized Diagnostic Tests |

### Faculty Demo Patients

| Full Name | Role | Login Email | Password | Phone Number | Blood Group | Primary Clinical Condition |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Amit Kumar** | Patient | `demo.faculty.amit.kumar@medicare.com` | `password123` | `+91 98201 12345` | O+ | Stage 1 Essential Hypertension |
| **Priya Nair** | Patient | `demo.faculty.priya.nair@medicare.com` | `password123` | `+91 98450 67890` | B+ | Episodic Migraine without Aura |
| **Suresh Deshmukh** | Patient | `demo.faculty.suresh.deshmukh@medicare.com` | `password123` | `+91 97654 32101` | A+ | Type 2 Diabetes Mellitus |
| **Kavita Reddy** | Patient | `demo.faculty.kavita.reddy@medicare.com` | `password123` | `+91 98840 54321` | AB+ | Seasonal Bronchial Congestion |

### Standalone Single-Page Application (`index.html`) Quick Login Credentials

For testing in the browser via `index.html` (Quick Role Switcher or standard login without external backend dependency):

| Account Name | Role | Email | Password | Highlights & Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | Admin | `admin@medicare.com` | `password123` | Staff Provisioning, Auditing, Analytics |
| **Dr. Sarah Jenkins** | Doctor | `doctor@medicare.com` | `password123` | Interventional Cardiology, OPD Prescriptions |
| **Dr. Ramesh Nair** | Doctor | `ramesh@medicare.com` | `password123` | Internal Medicine & Diabetology |
| **Dr. Ananya Sharma** | Doctor | `ananya@medicare.com` | `password123` | Neurology & Stroke Care |
| **Dr. Rajesh Mehta** | Doctor | `rajesh.mehta@medicare.com` | `password123` | Cardiology & Preventive Heart Care |
| **Dr. Arvind Kulkarni** | Doctor | `arvind.kulkarni@medicare.com` | `password123` | Orthopedic Surgery & Joint Replacement |
| **Dr. Priya Swaminathan** | Doctor | `priya.swaminathan@medicare.com` | `password123` | Pediatrics & Child Health |
| **Dr. Vikram Patel** | Doctor | `vikram.patel@medicare.com` | `password123` | Internal Medicine & Chronic Disease Care |
| **Mark Taylor** | Laboratory Staff | `lab@medicare.com` | `password123` | Laboratory Diagnostics & Slot Management |
| **Pooja Sharma** | Laboratory Staff | `pooja.lab@medicare.com` | `password123` | Routine & Biochemistry Lab Analysis |
| **Arjun Verma** | Laboratory Staff | `arjun.lab@medicare.com` | `password123` | Radiology & Ultrasound Screening |
| **John Doe** | Patient | `patient@medicare.com` | `password123` | OPD Consultations, Lab Booking & Health Portfolio |
| **Rachel Adams** | Receptionist | `receptionist@medicare.com` | `password123` | Outpatient Registration Desk |
| **Emily Blunt** | Pharmacist | `pharmacist@medicare.com` | `password123` | Pharmacy Stock & Dispensing |
| **David Miller** | Billing Staff | `billing@medicare.com` | `password123` | Cashier, Invoice Generation & Payments |

---

## 3. Linked Clinical & Operational Data Summary

The demo seed generates a consistent outpatient healthcare workflow:

1. **Appointments (5 total):**
   - **Amit Kumar with Dr. Rajesh Mehta:** 
     - Oct 10, 2026 (`Completed`, Token #1, OPD Consultation)
     - Oct 28, 2026 (`Scheduled`, Token #3, Follow-up Consultation with shared records enabled)
   - **Priya Nair with Dr. Sunita Rao:**
     - Oct 14, 2026 (`Completed`, Token #2, OPD Consultation)
   - **Suresh Deshmukh with Dr. Vikram Patel:**
     - Oct 18, 2026 (`Completed`, Token #4, OPD Consultation)
   - **Kavita Reddy with Dr. Vikram Patel:**
     - Oct 25, 2026 (`Scheduled`, Token #5, OPD Consultation)

2. **Completed Consultations (`medical_records`, `prescriptions`, `prescription_items`):**
   - **Amit Kumar:** Diagnosis of Stage 1 Essential Hypertension; prescribed *Atorvastatin 10mg* (0-0-1, 30 days) and *Aspirin 75mg* (1-0-0, 30 days).
   - **Priya Nair:** Diagnosis of Episodic Migraine; prescribed *Paracetamol 650mg* (1-0-1, 5 days) with lifestyle guidance.
   - **Suresh Deshmukh:** Diagnosis of Type 2 Diabetes Mellitus; prescribed *Metformin 500mg* (1-0-1, 30 days) with glycemic monitoring instructions.

3. **Laboratory Requests & Reports (`lab_requests`, `lab_reports`):**
   - **Amit Kumar:** 12-Lead Electrocardiogram (ECG) (`Completed`, Normal sinus rhythm, reference report: `demo_faculty_ecg_amit_kumar.pdf`).
   - **Amit Kumar:** Comprehensive Lipid Profile (`Completed`, Borderline cholesterol, reference report: `demo_faculty_lipid_profile_amit_kumar.pdf`).
   - **Priya Nair:** Complete Blood Count (CBC) (`Completed`, Normal hematology profile, reference report: `demo_faculty_cbc_priya_nair.pdf`).
   - **Suresh Deshmukh:** Complete Blood Count (CBC) (`Scheduled` fasting sample collection).

4. **Patient Portfolio & Appointment Shared Records (`patient_documents`, `appointment_shared_records`):**
   - 4 verified clinical documents stored across the patients' electronic medical records portfolios.
   - Amit Kumar's scheduled follow-up appointment (#2) is actively linked to his prior ECG and Lipid Profile reports for doctor verification during OPD.

5. **Invoices & Payments in INR (`bills`, `bill_items`, `payments`):**
   - **Bill #1 (Amit Kumar):** Total ₹1,300.00 (Consultation ₹800 + ECG ₹500), Discount ₹50, Tax ₹62.50, **Net Payable ₹1,312.50 INR** (`Paid` via UPI `UPI-DEMO-TXN-IN78901`). Matching payment recorded in `payments`.
   - **Bill #2 (Priya Nair):** Total ₹900.00, Tax ₹45.00, **Net Payable ₹945.00 INR** (`Paid` via Net Banking `NB-HDFC-DEMO-44321`). Matching payment recorded in `payments`.
   - **Bill #3 (Suresh Deshmukh):** Total ₹650.00, Tax ₹32.50, **Net Payable ₹682.50 INR** (`Pending`). No payment record created until payment is settled.

6. **Insurance & Illness History:**
   - Active insurance policies linked to Star Health, HDFC ERGO, and New India Assurance.
   - Chronic illness profiles registered in `patient_illnesses`.

7. **Patient-Doctor Chat:**
   - Active clinical dialogue between Dr. Rajesh Mehta and patient Amit Kumar regarding blood pressure tracking.

---

## 4. PDF & Document Flow Architectural Limitation

### Current System Architecture:
1. **No Static Upload Middleware in Express:**
   - The Node.js Express backend (`backend/server.js`) strictly exposes REST API endpoints under `/api/*`. It does not mount static file serving middleware (e.g. `app.use('/uploads', express.static(...))`).
   - There is no physical storage folder for uploaded report files in the project repository.
2. **Client-Side PDF Generation Engine:**
   - In the frontend (`index.html`), medical report previews and downloads are generated dynamically on the client side using **jsPDF** (`new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })`).
   - The database fields `report_url` in `lab_requests` / `lab_reports` and `file_url` in `patient_documents` store reference filename metadata (e.g., `demo_faculty_ecg_amit_kumar.pdf`).
3. **Seeding Decision:**
   - In adherence to project guidelines, we do **not** invent an artificial upload middleware or mock file server.
   - We seed the supported document metadata and report findings strings so they integrate cleanly with existing query endpoints (`/api/lab/requests`, `/api/patient/documents`, `/api/doctor/appointments/:id`), allowing full EHR inspection.

---

## 5. How to Run Seeding & Rollback

### Method 1: Using Node.js CLI (Recommended for Developers)

From the `backend/` directory:

```bash
# Opt-in to seed the faculty demo dataset:
npm run seed:demo

# Or run directly via Node:
node scripts/seed_faculty_demo.js

# To rollback and remove only the demo dataset:
npm run rollback:demo

# Or run rollback directly:
node scripts/rollback_faculty_demo.js
```

### Method 2: Using MySQL CLI or MySQL Workbench (For Database Administrators)

```bash
# Seed the demo dataset:
mysql -u root -p medicare_hms < database/faculty_demo_seed.sql

# Roll back the demo dataset:
mysql -u root -p medicare_hms < database/faculty_demo_rollback.sql
```

Both methods guarantee strict idempotence, atomic execution, and complete isolation from baseline application records.

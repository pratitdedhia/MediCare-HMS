# MediCare HMS - Database Documentation

This folder contains the database configuration for the **MediCare Hospital Management & Medical Report Management System**. The database is designed for a multi-role hospital ecosystem supporting Admin, Doctor, Patient, Receptionist, Laboratory, Pharmacist, and Billing interfaces.

## Database Details
- **Database Engine**: MySQL 8.0 / MariaDB
- **Database Name**: `medicare_hms`
- **Default Port**: `3306`

---

## Database Schema Structure

The database consists of **24 normalized tables** related through primary/foreign keys. Here is an overview of the schema tables:

### 1. User Authentication & Roles
- **`roles`**: Defines the user privileges (Admin, Doctor, Patient, Receptionist, Laboratory Staff, Pharmacist, Billing Staff).
- **`users`**: Central credentials table storing `email`, `password_hash`, and links to `roles`. All dashboards derive identity from this table.

### 2. Clinical Structure
- **`departments`**: Defines clinical sectors (e.g. Cardiology, Neurology) which doctors belong to.
- **`doctors`**: Extends `users` with clinical properties such as specialization, OPD fee, room number, weekly hours, and availability.
- **`patients`**: Extends `users` with medical card parameters, phone numbers, emergency contacts, DOB, address, and blood group.

### 3. Consultations & Medical Logs
- **`appointments`**: Manages visit scheduling, status updates ('Scheduled', 'Proposed', 'Completed', 'Cancelled'), reasons, and token queue counters.
- **`medical_records`**: OPD consultation summaries created by doctors. Logs diagnosis, notes, and links directly to appointments.
- **`prescriptions`**: Holds instructions linked to a medical record.
- **`prescription_items`**: Normalized rows connecting prescriptions to specific medicines with dosage instructions (e.g. `1-0-1`) and durations.
- **`patient_illnesses`**: Logs chronic conditions and past illnesses for the emergency card.
- **`insurance_policies`**: Links active medical insurance cards and coverage caps to the patient.

### 4. Diagnostics & Labs
- **`lab_tests`**: Catalog of diagnostic services and pricing.
- **`lab_requests`**: Connects patients/doctors to lab tests, tracks status ('Scheduled', 'Completed', 'Cancelled'), time slots, and technician operator signatures.
- **`lab_reports`**: Holds final result notes and report attachment URLs.

### 5. Pharmacy & Sales
- **`medicines`**: Inventory stock and unit prices.
- **`medicine_sales`**: Receipts tracking checkout transactions.
- **`medicine_sale_items`**: Detailed line-items mapping medicines purchased per sale transaction.
- **`inventory_transactions`**: Audit trail of stocks added ('Stock In') or sold/dispensed ('Stock Out').

### 6. Billing & Accounts
- **`bills`**: Master invoice table tracking consult/appointment dues, tax, discount, and status ('Paid', 'Pending').
- **`bill_items`**: Billing details describing itemized charges.
- **`payments`**: Transaction records linking payments to bills or medicine sales.

### 7. Support & Utilities
- **`doctor_availability`**: Logs leaves and off-duty dates.
- **`chat_messages`**: Secure communications between doctors and patients.
- **`announcements`**: System-wide announcements created by admins.

---

## Setup & Import Instructions

You can import this schema and seed data directly through MySQL Workbench, phpMyAdmin, or the MySQL command line tool.

### Using Command Line
Ensure your local MySQL service is running, then execute the following commands in the workspace root:

1. Import schema tables:
   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. Seed initial data:
   ```bash
   mysql -u root -p < database/seed.sql
   ```
*(If your root account has no password, omit the `-p` parameter)*

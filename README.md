# MediCare HMS – Hospital Management & Medical Report Management System

**Client:** Sunrise Multi-Speciality Hospital  
**Technology Stack:** React, Bootstrap, Node.js, Express, MySQL, Chart.js, JWT, Multer, jsPDF  

---

## 📌 Project Overview
MediCare HMS is a full-stack, enterprise-grade Hospital Management and Medical Report System built for **Sunrise Multi-Speciality Hospital**. It automates paperless records, online appointment booking, doctor consultations, digital prescriptions, laboratory test reports, pharmacy stock management, medicine sales, and automated patient billing with downloadable PDF receipts.

### Key Features & User Roles
1. **Admin**: Manage hospital staff, doctors, departments, announcements, system analytics, and reports.
2. **Receptionist**: Register patients, book appointments, view doctor schedules, generate queue tokens.
3. **Doctor**: View today's appointments, consult patients, write prescriptions, request lab tests, view patient history.
4. **Laboratory Staff**: Track pending lab requests, upload test report PDFs, update test status.
5. **Pharmacist**: Manage medicine inventory, dispense prescribed medicines, track sales, purchase orders, low-stock alerts.
6. **Billing Staff**: Create patient invoices, process payments, add discounts & taxes, print/download PDF receipts.
7. **Patient**: Register & log in, book appointments, view prescriptions, view & download lab report PDFs, pay bills online, view appointment history.

---

## 📁 Repository Structure
```
Hospital Management & Medical Report Management System/
├── backend/
│   ├── config/
│   │   └── db.js               # MySQL Connection Pool
│   ├── middleware/
│   │   ├── auth.js             # JWT Auth & Role Authorization
│   │   └── upload.js           # Multer PDF / Image Upload Setup
│   ├── routes/
│   │   ├── auth.js             # User login, registration, profile
│   │   ├── admin.js            # Doctor/Staff/Department management
│   │   ├── patient.js          # Patient portal APIs
│   │   ├── doctor.js           # Consultations & prescriptions
│   │   ├── receptionist.js     # Patient registration & appointment booking
│   │   ├── lab.js              # Lab tests & PDF report uploads
│   │   ├── pharmacy.js         # Inventory, purchases, sales
│   │   ├── billing.js          # Invoices & receipts
│   │   ├── reports.js          # Analytical reporting APIs
│   │   └── announcements.js    # Hospital announcements
│   ├── uploads/                # File storage for lab PDFs
│   ├── db/
│   │   └── schema.sql          # Complete MySQL Schema & Demo Seed Data
│   ├── .env.example            # Environment sample
│   └── server.js               # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, Sidebar, StatCards, Footer
│   │   ├── pages/              # 25+ view components & 7 Role Dashboards
│   │   ├── context/            # Global Auth Context
│   │   ├── utils/              # API helper & jsPDF receipt generator
│   │   ├── App.jsx             # React router & role guards
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   └── vite.config.js
├── README.md
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v16+ or v18+
- **MySQL**: v8.0+ (MySQL Server / XAMPP / WAMP)
- **Git**

---

### Step 1: Database Setup
1. Open your MySQL client (MySQL Workbench, phpMyAdmin, or MySQL CLI).
2. Create the database and run `backend/db/schema.sql`:
   ```bash
   mysql -u root -p < backend/db/schema.sql
   ```
   *(Or copy the content of `backend/db/schema.sql` into phpMyAdmin / MySQL Workbench Query Window and execute).*

---

### Step 2: Backend Setup
1. Navigate into the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (you can copy `.env.example`):
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=medicare_hms
   JWT_SECRET=medicare_super_secret_jwt_key_2026
   ```
4. Start the backend server:
   ```bash
   npm run dev
   # OR
   node server.js
   ```
   The backend runs on **`http://localhost:5000`**.

---

### Step 3: Frontend Setup
1. Open a new terminal and navigate into the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **`http://localhost:5173`**.

---

## 🔑 Demo Login Credentials (Pre-seeded in DB)

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@medicare.com` | `admin123` |
| **Doctor** | `doctor@medicare.com` | `doctor123` |
| **Receptionist** | `receptionist@medicare.com` | `receptionist123` |
| **Laboratory** | `lab@medicare.com` | `lab123` |
| **Pharmacist** | `pharmacist@medicare.com` | `pharmacist123` |
| **Billing** | `billing@medicare.com` | `billing123` |
| **Patient** | `patient@medicare.com` | `patient123` |

---

## 📤 How to Upload to GitHub

1. Initialize git in the root folder (if not already done):
   ```bash
   git init
   ```
2. Add all files:
   ```bash
   git add .
   ```
3. Commit changes:
   ```bash
   git commit -m "Initial commit - MediCare HMS Full Stack Project"
   ```
4. Create a new public repository on GitHub named `MediCare-HMS`.
5. Link and push to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/MediCare-HMS.git
   git branch -M main
   git push -u origin main
   ```

---

## 📄 License
Developed for Sunrise Multi-Speciality Hospital. All rights reserved.

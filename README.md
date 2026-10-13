# Campus Lost & Found Portal 🎒

A premium full-stack application for college students to report lost items and post found items.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB (Running locally or on Atlas)

### 1. Configuration
Update the environment variables in both `backend/.env` and `frontend/.env`.

**Backend (`backend/.env`):**
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/campus_lost_found
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
FRONTEND_URL=http://localhost:3000

# Used only by scripts/seedAdmin.js — required, no default password.
SEED_ADMIN_EMAIL=admin@yourcollege.edu
SEED_ADMIN_PASSWORD=choose-a-strong-password
SEED_ADMIN_NAME=Admin User
SEED_ADMIN_COLLEGE_ID=ADMIN001
SEED_ADMIN_PHONE=0000000000
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:5000/api
```

### 2. Setup & Installation

**Install Backend Dependencies:**
```bash
cd backend
npm install
```

**Install Frontend Dependencies:**
```bash
cd frontend
npm install
```

### 3. Seed Admin User
Since registration defaults to "student", run the seed script to create an admin account. It reads its credentials from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (set in `backend/.env` — see above) rather than a hardcoded default, so set those first:
```bash
cd backend
node scripts/seedAdmin.js
```
The script will refuse to run (with a clear message) if those two variables aren't set, or if the password is under 8 characters.

### 4. Running the App

**Start Backend:**
```bash
cd backend
npm run dev
```

**Start Frontend:**
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:3000`.

## ✅ Testing

**Backend** (Jest + Supertest, mocked models — no live MongoDB required):
```bash
cd backend
npm test
```

**Frontend** (Vitest + React Testing Library):
```bash
cd frontend
npm test
```

## 🔁 CI

`.github/workflows/ci.yml` runs the backend test suite and the frontend production build on every push/PR to `main`, across Node 18.x and 20.x.

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, Bootstrap 5, Axios
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Auth**: JWT, bcryptjs
- **Features**: OTP verification (Nodemailer), Image Upload (Multer), Auto-expiry (cron)

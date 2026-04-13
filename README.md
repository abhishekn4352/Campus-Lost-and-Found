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
Since registration defaults to "student", run the seed script to create an admin account:
```bash
cd backend
node scripts/seedAdmin.js
```

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

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, Bootstrap 5, Axios
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Auth**: JWT, bcryptjs
- **Features**: OTP verification (Nodemailer), Image Upload (Multer), Auto-expiry (cron)

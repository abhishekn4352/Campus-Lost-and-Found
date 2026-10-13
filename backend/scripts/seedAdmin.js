const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    // Credentials must be supplied via environment variables — there is
    // intentionally no hardcoded fallback password, so a forgotten .env
    // can never result in a known/default admin credential in any
    // environment (dev included).
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const adminName = process.env.SEED_ADMIN_NAME || 'Admin User';
    const adminCollegeId = process.env.SEED_ADMIN_COLLEGE_ID || 'ADMIN001';

    if (!adminEmail || !adminPassword) {
      console.error('Missing SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD environment variables.');
      console.error('Set them (e.g. in backend/.env) before running this script:');
      console.error('  SEED_ADMIN_EMAIL=admin@yourcollege.edu SEED_ADMIN_PASSWORD=<a-strong-password> node scripts/seedAdmin.js');
      process.exit(1);
    }
    if (adminPassword.length < 8) {
      console.error('SEED_ADMIN_PASSWORD must be at least 8 characters long.');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit();
    }

    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      phone: process.env.SEED_ADMIN_PHONE || '0000000000',
      collegeId: adminCollegeId,
      role: 'admin',
      isVerified: true,
    });

    console.log('Admin user created successfully:');
    console.log(`Email: ${adminEmail}`);
    console.log('Password: (as provided via SEED_ADMIN_PASSWORD — not logged)');

    process.exit();
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
};

seedAdmin();

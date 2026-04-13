const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const adminEmail = 'admin@college.edu';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit();
    }

    const admin = await User.create({
      name: 'Admin User',
      email: adminEmail,
      password: 'adminpassword123', // Change this in production!
      collegeId: 'ADMIN001',
      role: 'admin',
    });

    console.log('Admin user created successfully:');
    console.log(`Email: ${adminEmail}`);
    console.log('Password: adminpassword123');

    process.exit();
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
};

seedAdmin();

/**
 * UniAttest — Super Admin Setup Script
 * Run this once from the server/ folder:
 *   node setup-admin.js
 *
 * This creates a super admin or resets the password if it already exists.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const ADMIN_EMAIL    = 'admin@university.edu';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME     = 'Super Admin';

async function setup() {
  console.log('\n🔧  UniAttest Admin Setup\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  MongoDB connected');

    // Manually hash — bypass the pre-save hook to be certain
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // Dynamically load model after connection
    const User = require('./src/models/User');

    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      // Reset password and make super_admin
      existing.passwordHash = hash;
      existing.role = 'super_admin';
      existing.isActive = true;
      await existing.save({ validateBeforeSave: false });
      console.log('✅  Existing admin found — password reset and role set to super_admin');
    } else {
      // Create fresh
      await User.create({
        email: ADMIN_EMAIL,
        passwordHash: hash,
        fullName: ADMIN_NAME,
        studentId: 'SUPERADMIN-001',
        role: 'super_admin',
        isActive: true
      });
      console.log('✅  Super admin created fresh');
    }

    console.log('\n─────────────────────────────────');
    console.log('  Admin login credentials:');
    console.log(`  Email   : ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('─────────────────────────────────\n');

    // Verify it works
    const check = await User.findOne({ email: ADMIN_EMAIL });
    const valid = await bcrypt.compare(ADMIN_PASSWORD, check.passwordHash);
    if (valid) {
      console.log('✅  Password verified — login will work\n');
    } else {
      console.log('❌  Password verification failed — something is wrong\n');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  }
}

setup();
/**
 * UniAttest — Super Admin Setup Script
 * Run this once from the server/ folder:
 *   node setup-admin.js
 *
 * This creates a super admin once; existing accounts are never reset.
 */

const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@university.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || randomBytes(24).toString('base64url');
if (Buffer.byteLength(ADMIN_PASSWORD) < 12 || Buffer.byteLength(ADMIN_PASSWORD) > 72) throw new Error('ADMIN_PASSWORD must be between 12 and 72 bytes.');
const ADMIN_NAME     = 'Super Admin';

async function setup() {
  console.log('\n🔧  UniAttest Admin Setup\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  MongoDB connected');



    // Dynamically load model after connection
    const User = require('./src/models/User');

    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      console.log('Account already exists; setup will not reset its password or change its role.');
      await mongoose.disconnect();
      return;
    } else {
      // Create fresh
      await User.create({
        email: ADMIN_EMAIL,
        passwordHash: ADMIN_PASSWORD,
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
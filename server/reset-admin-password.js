const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
require('dotenv').config();
const User = require('./src/models/User');

async function resetPassword() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || 'admin@university.edu').trim().toLowerCase();
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/degree_attestation', {
      serverSelectionTimeoutMS: 5000
    });
    const admin = await User.findOne({ email, role: { $in: ['admin', 'super_admin'] } });
    if (!admin) throw new Error('No admin account found for that email. No account was changed.');
    if (!admin.isActive) throw new Error('This account is inactive. Password reset will not reactivate it.');
    const password = randomBytes(24).toString('base64url');
    admin.passwordHash = password;
    admin.tokenVersion += 1;
    admin.refreshTokenHash = undefined;
    await admin.save();
    console.log('Admin password reset. Previous sessions have been invalidated.');
    console.log(`Email: ${admin.email}`);
    console.log(`New password: ${password}`);
    console.log('Save this password, then change it from Account after signing in.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', ...require('../services/workflow').STAFF_ROLES],
    default: 'student'
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  studentId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  fatherName: { type: String, trim: true },
  // Pakistani CNIC as 00000-0000000-0. Prefills each new attestation request.
  cnic: { type: String, trim: true, unique: true, sparse: true },
  department: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tokenVersion: { type: Number, default: 0 },
  refreshTokenHash: { type: String, select: false },
  // SHA-256 of a single-use emailed reset token; the token itself is never stored.
  passwordResetHash: { type: String, select: false, index: { sparse: true } },
  passwordResetExpires: { type: Date, select: false },

  photoUrl: {
  type: String,
  default: null
}

}, {
  timestamps: true
});

// ✅ FIX: Mongoose v8 async pre-save hooks don't use next()
userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

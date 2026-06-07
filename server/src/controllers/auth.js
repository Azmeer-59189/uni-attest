const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // ✅ FIX: was 15m — too short, caused silent logouts
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Consistent user shape returned in every response
const formatUser = (user) => ({
  _id: user._id,   // ✅ FIX: was 'id' — AuthContext reads '_id'
  id: user._id,    // keep both for safety
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  studentId: user.studentId,
  department: user.department,
  phone: user.phone,
  isActive: user.isActive
});

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, studentId, department, phone } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Check student ID uniqueness if provided
    if (studentId) {
      const existingId = await User.findOne({ studentId });
      if (existingId) {
        return res.status(409).json({ error: 'Student ID already registered.' });
      }
    }

    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      fullName,
      studentId: studentId || undefined,
      department,
      phone,
      role: 'student' // ✅ always student — admins created separately
    });
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);
    logger.info(`New student registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful',
      user: formatUser(user),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Your account has been deactivated. Contact the administrator.' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    logger.info(`User logged in: ${email} (${user.role})`);

    res.json({
      message: 'Login successful',
      user: formatUser(user),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.json(formatUser(req.user));
  } catch (error) {
    next(error);
  }
};
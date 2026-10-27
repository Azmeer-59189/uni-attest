const { createHash, randomBytes, randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');
const notify = require('../services/notify');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion, jti: randomUUID() },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash: tokenHash(refreshToken) } });
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
  fatherName: user.fatherName,
  cnic: user.cnic,
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

    const { email, password, fullName, studentId, fatherName, cnic, department, phone } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    if (studentId && await User.exists({ studentId })) {
      return res.status(409).json({ error: 'This registration number already has an account.' });
    }
    if (await User.exists({ cnic })) {
      return res.status(409).json({ error: 'This CNIC already has an account. Sign in, or reset your password.' });
    }

    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      fullName,
      studentId: studentId || undefined,
      fatherName,
      cnic,
      department,
      phone,
      role: 'student' // ✅ always student — admins created separately
    });
    await user.save();

    const { accessToken, refreshToken } = await generateTokens(user);
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

    const { accessToken, refreshToken } = await generateTokens(user);
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
exports.refresh = async (req, res, next) => {
  try {
    if (typeof req.body.refreshToken !== 'string') return res.status(401).json({ error: 'A refresh token is required.' });
    let decoded;
    try { decoded = jwt.verify(req.body.refreshToken, process.env.REFRESH_TOKEN_SECRET); }
    catch (_) { return res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
    const user = await User.findOne({ _id: decoded.userId, isActive: true });
    if (!user || user.tokenVersion !== decoded.tokenVersion) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    const accessToken = jwt.sign({ userId: user._id, role: user.role, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user._id, tokenVersion: user.tokenVersion, jti: randomUUID() }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    const versionFilter = decoded.tokenVersion === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: decoded.tokenVersion };
    const rotated = await User.updateOne({ _id: user._id, isActive: true, ...versionFilter, refreshTokenHash: tokenHash(req.body.refreshToken) }, { $set: { refreshTokenHash: tokenHash(refreshToken) } });
    if (!rotated.modifiedCount) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    res.json({ accessToken, refreshToken, user: formatUser(user) });
  } catch (error) { next(error); }
};

exports.logout = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 }, $unset: { refreshTokenHash: '' } });
    res.json({ message: 'Signed out.' });
  } catch (error) { next(error); }
};

const validNewPassword = value => typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value) <= 72;

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || !validNewPassword(newPassword)) {
      return res.status(400).json({ error: 'Use a new password between 12 and 72 bytes.' });
    }
    if (!await req.user.comparePassword(currentPassword)) return res.status(400).json({ error: 'Current password is incorrect.' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'Choose a different password.' });
    req.user.passwordHash = newPassword;
    req.user.tokenVersion += 1;
    req.user.refreshTokenHash = undefined;
    await req.user.save();
    res.json({ message: 'Password changed. Please sign in again.' });
  } catch (error) { next(error); }
};

const RESET_TTL_MS = 30 * 60 * 1000;
const resetSent = { message: 'If an account exists for that email, a reset link is on its way. It expires in 30 minutes.' };

// Always answers the same way for known and unknown emails, so the form can't be used to discover accounts.
exports.forgotPassword = async (req, res, next) => {
  try {
    if (!notify.enabled()) return res.status(503).json({ error: 'Password reset by email isn’t available. Contact the registrar’s office to regain access.' });
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ error: 'Enter your email address.' });
    const token = randomBytes(32).toString('hex');
    const user = await User.findOneAndUpdate(
      { email, isActive: true },
      { $set: { passwordResetHash: tokenHash(token), passwordResetExpires: new Date(Date.now() + RESET_TTL_MS) } },
      { new: true }
    );
    if (user) notify.sendPasswordReset(user, token);
    res.json(resetSent);
  } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    if (!validNewPassword(newPassword)) return res.status(400).json({ error: 'Use a new password between 12 and 72 bytes.' });
    // Claim the token atomically so a link can only be used once, even by concurrent requests.
    const user = await User.findOneAndUpdate(
      { passwordResetHash: tokenHash(token), passwordResetExpires: { $gt: new Date() }, isActive: true },
      { $unset: { passwordResetHash: '', passwordResetExpires: '', refreshTokenHash: '' }, $inc: { tokenVersion: 1 } },
      { new: true }
    );
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    user.passwordHash = newPassword;
    await user.save();
    logger.info(`Password reset completed for user ${user._id}`);
    res.json({ message: 'Password reset. Sign in with your new password.' });
  } catch (error) { next(error); }
};

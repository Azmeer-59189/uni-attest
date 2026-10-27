const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const faceRoutes = require('./routes/face');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const verifyRoutes = require('./routes/verify');
const ocrRoutes = require('./routes/ocr');          // ← ADD THIS
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

const PORT = process.env.PORT || 5000;


// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);
app.locals.rateLimiter = limiter;

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Public certificates are checked against their saved issuance snapshot.
app.get('/uploads/certificates/:filename', async (req, res, next) => {
  try {
    const match = /^certificate-([a-f0-9]{64})\.pdf$/.exec(req.params.filename);
    const degree = match && await require('./models/Degree').findOne({ hash: match[1], issuanceStatus: 'issued' });
    if (!degree || !require('./services/integrity').checkIntegrity(degree).verified) return res.status(404).json({ error: 'Certificate not found.' });
    res.sendFile(path.join(__dirname, '../uploads/certificates', req.params.filename), (error) => { if (error) next(error); });
  } catch (error) { next(error); }
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', require('./routes/files'));
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/face', faceRoutes);               // ← ADD THIS

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    const chainReady = await require('./services/blockchain').initialize();
    if (!chainReady && process.env.BLOCKCHAIN_NETWORK === 'local') throw new Error('Local blockchain is not ready. Start the project with npm run dev:local from the project root.');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/degree_attestation');
    await Promise.all([require('./models/Application').init(), require('./models/Degree').init(), require('./models/User').init()]);
    logger.info('MongoDB connected successfully.');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) startServer();

module.exports = app;

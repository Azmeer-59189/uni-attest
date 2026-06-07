const crypto = require('crypto');
const logger = require('../utils/logger');

class HashService {
  generateDegreeHash(degreeData) {
    const canonicalData = {
      studentName: (degreeData.studentName || degreeData.fullName || '').toLowerCase().trim(),
      studentId: (degreeData.studentId || '').toUpperCase().trim(),
      program: (degreeData.program || degreeData.programName || '').toLowerCase().trim(),
      department: (degreeData.department || '').toLowerCase().trim(),
      graduationYear: degreeData.graduationYear || degreeData.graduation_year,
      cgpa: degreeData.cgpa ? parseFloat(degreeData.cgpa).toFixed(2) : null,
      university: degreeData.university || process.env.UNIVERSITY_NAME || 'University',
      issuedAt: degreeData.issuedAt ? new Date(degreeData.issuedAt).toISOString() : new Date().toISOString()
    };

    Object.keys(canonicalData).forEach(key => {
      if (canonicalData[key] === null || canonicalData[key] === undefined) {
        delete canonicalData[key];
      }
    });

    const dataString = JSON.stringify(canonicalData, Object.keys(canonicalData).sort());
    logger.info(`Generating hash for data: ${dataString}`);

    const hash = crypto.createHash('sha256').update(dataString).digest('hex');
    logger.info(`Generated hash: ${hash}`);

    return hash;
  }

  verifyDegreeHash(degreeData, expectedHash) {
    const computedHash = this.generateDegreeHash(degreeData);
    return computedHash === expectedHash;
  }

  generateQRData(hash, baseUrl) {
    return `${baseUrl}/verify/${hash}`;
  }

  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }
}

module.exports = new HashService();
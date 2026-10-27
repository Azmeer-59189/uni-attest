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
      // Attestation fields. Absent on certificates issued before the staged workflow, which keeps their hashes valid.
      fatherName: degreeData.fatherName ? degreeData.fatherName.toLowerCase().trim() : undefined,
      cnic: degreeData.cnic ? degreeData.cnic.trim() : undefined,
      registrationNumber: degreeData.registrationNumber ? degreeData.registrationNumber.toUpperCase().trim() : undefined,
      session: degreeData.session ? degreeData.session.trim() : undefined,
      requestType: degreeData.requestType || undefined,
      attestationNumber: degreeData.attestationNumber || undefined,
      cgpa: degreeData.cgpa !== undefined && degreeData.cgpa !== null && degreeData.cgpa !== '' ? parseFloat(degreeData.cgpa).toFixed(2) : null,
      university: degreeData.university || process.env.UNIVERSITY_NAME || 'University',
      issuedAt: degreeData.issuedAt ? new Date(degreeData.issuedAt).toISOString() : new Date().toISOString()
    };

    Object.keys(canonicalData).forEach(key => {
      if (canonicalData[key] === null || canonicalData[key] === undefined) {
        delete canonicalData[key];
      }
    });

    const dataString = JSON.stringify(canonicalData, Object.keys(canonicalData).sort());

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

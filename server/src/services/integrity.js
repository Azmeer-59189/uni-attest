const hash = require('./hash');

exports.checkIntegrity = (degree) => {
  if (!degree.snapshot) return { verified: false, status: 'legacy_unverified', error: 'This legacy record has no immutable issuance snapshot and needs manual review.' };
  if (degree.issuanceStatus !== 'issued') return { verified: false, status: 'issuance_pending', error: 'Issuance is not complete.' };
  const snapshot = degree.snapshot.toObject ? degree.snapshot.toObject() : degree.snapshot;
  if (!snapshot.issuedAt || !hash.verifyDegreeHash(snapshot, degree.hash.replace(/^0x/, ''))) {
    return { verified: false, status: 'integrity_failed', error: 'The issued details do not match the recorded hash.' };
  }
  return { verified: true, status: 'integrity_verified' };
};

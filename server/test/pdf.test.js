const fs = require('fs');
const pdf = require('../src/services/pdf');
const hash = require('../src/services/hash');

test('generates a complete certificate file before returning its public URL', async () => {
  const snapshot = { studentName: 'Test Student', studentId: 'ST-1', program: 'BS Computing', department: 'Computing', graduationYear: 2026, university: 'Test University', cgpa: 0, issuedAt: '2026-10-26T00:00:00.000Z' };
  const degreeHash = hash.generateDegreeHash(snapshot);
  const file = await pdf.generateCertificate({ ...snapshot, hash: degreeHash }, 'https://university.example');
  try {
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.subarray(-30).toString()).toContain('%%EOF');
    expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(pdf.getCertificateUrl(degreeHash)).toBe(`/uploads/certificates/certificate-${degreeHash}.pdf`);
    expect(fs.readdirSync(require('path').dirname(file)).some(name => name.startsWith(`certificate-${degreeHash}.pdf.`))).toBe(false);
  } finally { fs.unlinkSync(file); }
});

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const { randomUUID } = require('crypto');
const path = require('path');

const CERTIFICATES_DIR = path.join(__dirname, '../../uploads/certificates');

if (!fs.existsSync(CERTIFICATES_DIR)) {
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
}

const getSafeHash = (hash) => hash.replace(/[^a-zA-Z0-9]/g, '');

exports.generateCertificate = async (data, clientUrl = 'http://localhost:5173') => {
  const safeHash = getSafeHash(data.hash);
  const fileName = `certificate-${safeHash}.pdf`;
  const filePath = path.join(CERTIFICATES_DIR, fileName);

  const verificationUrl = `${clientUrl || 'http://localhost:5173'}/verify/${data.hash}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 120,
    margin: 1,
    color: { dark: '#0D1B2A', light: '#FFFFFF' }
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  const issued = new Date(data.issuedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
  const requestLabels = { degree: 'Degree', transcript: 'Transcript', degree_transcript: 'Degree and Transcript' };
  const documentLabel = requestLabels[data.requestType] || 'Degree';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 }, autoFirstPage: true, bufferPages: true });

    const tempPath = `${filePath}.${randomUUID()}.tmp`;
    const stream = fs.createWriteStream(tempPath);
    const fail = (error) => { stream.destroy(); fs.unlink(tempPath, () => {}); reject(error); };
    doc.on('error', fail);
    stream.on('error', fail);
    doc.pipe(stream);

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89
    const left = 64;
    const width = W - left * 2;
    const ink = '#1d2025';
    const navy = '#1f3a5f';
    const muted = '#6a6f77';
    const rule = '#c9c3b6';

    // Letterhead
    doc.rect(0, 0, W, H).fill('#ffffff');
    doc.rect(0, 0, W, 6).fill(navy);
    doc.font('Times-Bold').fontSize(20).fillColor(ink)
       .text(data.university || 'University', left, 52, { width, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(muted)
       .text('OFFICE OF THE REGISTRAR  ·  DEGREE ATTESTATION CELL', left, 80, { width, align: 'center', characterSpacing: 1.2 });
    doc.moveTo(left, 104).lineTo(W - left, 104).lineWidth(0.75).stroke(ink);
    doc.moveTo(left, 107).lineTo(W - left, 107).lineWidth(0.25).stroke(ink);

    // Reference line
    doc.font('Helvetica').fontSize(9).fillColor(ink);
    doc.text(`No. ${data.attestationNumber || 'Not numbered'}`, left, 122, { width: width / 2, lineBreak: false });
    doc.text(`Dated: ${issued}`, left + width / 2, 122, { width: width / 2, align: 'right', lineBreak: false });

    // Title
    doc.font('Times-Bold').fontSize(17).fillColor(ink)
       .text(`${documentLabel.toUpperCase()} ATTESTATION CERTIFICATE`, left, 160, { width, align: 'center', characterSpacing: 0.5 });
    doc.font('Helvetica').fontSize(9).fillColor(muted).text('TO WHOM IT MAY CONCERN', left, 184, { width, align: 'center', characterSpacing: 1 });

    // Statement
    const relation = data.fatherName ? `, son/daughter of ${data.fatherName}` : '';
    doc.font('Times-Roman').fontSize(12).fillColor(ink)
       .text(`This is to certify that the ${documentLabel.toLowerCase()} of ${data.studentName}${relation}, particulars of which are given below, has been verified from the record of this University and is found to be genuine.`, left, 216, { width, align: 'justify', lineGap: 3 });

    // Particulars
    const rows = [
      ['Name', data.studentName],
      ['Father’s name', data.fatherName],
      ['CNIC', data.cnic],
      ['Registration no.', data.registrationNumber || data.studentId],
      ['Degree', data.program],
      ['Department', data.department],
      ['Session', data.session],
      ['Year of passing', data.graduationYear],
      ['CGPA', data.cgpa != null ? Number(data.cgpa).toFixed(2) : null]
    ].filter(([, value]) => value != null && value !== '');
    let y = doc.y + 22;
    doc.moveTo(left, y).lineTo(W - left, y).lineWidth(0.5).stroke(rule);
    for (const [label, value] of rows) {
      doc.font('Helvetica').fontSize(9).fillColor(muted).text(label, left + 4, y + 8, { width: 150, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(String(value), left + 160, y + 7, { width: width - 164, lineBreak: false, ellipsis: true });
      y += 24;
      doc.moveTo(left, y).lineTo(W - left, y).lineWidth(0.5).stroke(rule);
    }

    // Signature and QR
    const signY = y + 70;
    doc.image(qrBuffer, left, signY - 30, { width: 92, height: 92 });
    doc.font('Helvetica').fontSize(7.5).fillColor(muted)
       .text('Scan to verify, or visit', left, signY + 66, { width: 160 })
       .text(`${(clientUrl || '').replace(/^https?:\/\//, '')}/verify`, left, signY + 76, { width: 200 });
    doc.moveTo(W - left - 180, signY + 30).lineTo(W - left, signY + 30).lineWidth(0.5).stroke(ink);
    doc.font('Times-Bold').fontSize(11).fillColor(ink).text('Registrar', W - left - 180, signY + 36, { width: 180, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(muted).text(data.university || 'University', W - left - 180, signY + 52, { width: 180, align: 'center' });

    // Verification footer
    const footY = H - 118;
    doc.moveTo(left, footY).lineTo(W - left, footY).lineWidth(0.5).stroke(rule);
    doc.font('Helvetica').fontSize(7.5).fillColor(muted)
       .text('This certificate is issued electronically. Its authenticity can be confirmed online with the attestation number or the verification hash below; no signature or stamp is required for online verification.', left, footY + 10, { width, lineGap: 1.5 });
    doc.font('Courier').fontSize(7).fillColor(ink)
       .text(`Verification hash: ${data.hash}`, left, footY + 40, { width, lineBreak: false })
       .text(data.blockchainTx ? `${data.blockchainNetwork === 'hardhat_local' ? 'Local test chain' : 'Polygon Amoy'} transaction: ${data.blockchainTx}` : 'Blockchain record: not used for this certificate', left, footY + 52, { width, lineBreak: false });
    doc.rect(0, H - 6, W, 6).fill(navy);

    doc.flushPages();
    doc.end();

    stream.on('finish', () => {
      fs.rename(tempPath, filePath, (error) => { if (error) fail(error); else resolve(filePath); });
    });
  });
};

exports.getCertificateUrl = (hash) => {
  const safeHash = getSafeHash(hash);
  return `/uploads/certificates/certificate-${safeHash}.pdf`;
};

exports.certificateExists = (hash) => {
  const safeHash = getSafeHash(hash);
  const fileName = `certificate-${safeHash}.pdf`;
  return fs.existsSync(path.join(CERTIFICATES_DIR, fileName));
};

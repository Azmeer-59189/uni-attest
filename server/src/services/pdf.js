/**
 * UniAttest — PDF Certificate Generation Service
 * Uses pdfkit (no browser/Puppeteer needed — much lighter)
 * Run: npm install pdfkit qrcode in server/
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const CERTIFICATES_DIR = path.join(__dirname, '../../uploads/certificates');

// Make sure certificates folder exists
if (!fs.existsSync(CERTIFICATES_DIR)) {
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
}

/**
 * Generate a degree certificate PDF
 * @param {Object} data - degree data
 * @param {string} data.studentName
 * @param {string} data.studentId
 * @param {string} data.program
 * @param {string} data.department
 * @param {number} data.graduationYear
 * @param {number} data.cgpa
 * @param {string} data.university
 * @param {Date}   data.issuedAt
 * @param {string} data.hash
 * @param {string} data.blockchainTx
 * @param {string} clientUrl - base URL for QR code link
 * @returns {Promise<string>} - file path of generated PDF
 */
exports.generateCertificate = async (data, clientUrl = 'http://localhost:5173') => {
  const fileName = `certificate-${data.hash.slice(0, 16)}.pdf`;
  const filePath = path.join(CERTIFICATES_DIR, fileName);

  // Generate QR code as base64 image
  const verifyUrl = `${clientUrl}/verify/${data.hash}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 120,
    margin: 1,
    color: { dark: '#0D1B2A', light: '#FFFFFF' }
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 60, right: 60 }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;

    // ── BACKGROUND ──
    doc.rect(0, 0, W, H).fill('#FAFAF8');

    // Navy border
    doc.rect(20, 20, W - 40, H - 40)
       .lineWidth(3)
       .stroke('#0D1B2A');

    // Inner gold border
    doc.rect(28, 28, W - 56, H - 56)
       .lineWidth(1)
       .stroke('#C9A84C');

    // ── HEADER BAND ──
    doc.rect(20, 20, W - 40, 80).fill('#0D1B2A');

    // University name in header
    doc.fontSize(11)
       .fillColor('#C9A84C')
       .font('Helvetica')
       .text(
         (data.university || 'UNIVERSITY').toUpperCase(),
         0, 38,
         { align: 'center', width: W }
       );

    doc.fontSize(8)
       .fillColor('rgba(250,250,248,0.55)')
       .text('DEGREE ATTESTATION PORTAL — UNIATTEST', 0, 58, { align: 'center', width: W });

    // ── GOLD DIVIDER ──
    doc.moveTo(60, 120).lineTo(W - 60, 120).lineWidth(1).stroke('#C9A84C');

    // ── TITLE ──
    doc.fontSize(11)
       .fillColor('#C9A84C')
       .font('Helvetica')
       .text('THIS IS TO CERTIFY THAT', 0, 135, { align: 'center', width: W });

    // ── STUDENT NAME ──
    doc.fontSize(36)
       .fillColor('#0D1B2A')
       .font('Helvetica-Bold')
       .text(data.studentName, 0, 158, { align: 'center', width: W });

    // Name underline
    const nameWidth = doc.widthOfString(data.studentName);
    const nameX = (W - nameWidth) / 2;
    doc.moveTo(nameX, 200).lineTo(nameX + nameWidth, 200).lineWidth(0.5).stroke('#C9A84C');

    // ── BODY TEXT ──
    doc.fontSize(12)
       .fillColor('#444444')
       .font('Helvetica')
       .text(
         `having successfully completed all requirements, has been awarded the degree of`,
         80, 215,
         { align: 'center', width: W - 160 }
       );

    // ── PROGRAM ──
    doc.fontSize(22)
       .fillColor('#0D1B2A')
       .font('Helvetica-Bold')
       .text(data.program, 0, 240, { align: 'center', width: W });

    // ── DEPARTMENT & YEAR ──
    doc.fontSize(11)
       .fillColor('#666666')
       .font('Helvetica')
       .text(
         `Department of ${data.department}  ·  Graduation Year: ${data.graduationYear}${data.cgpa ? `  ·  CGPA: ${data.cgpa}` : ''}`,
         0, 272,
         { align: 'center', width: W }
       );

    // ── GOLD DIVIDER ──
    doc.moveTo(60, 298).lineTo(W - 60, 298).lineWidth(1).stroke('#C9A84C');

    // ── FOOTER SECTION ──
    const footerY = 316;

    // Issue date (left)
    doc.fontSize(9)
       .fillColor('#888888')
       .font('Helvetica')
       .text('DATE OF ISSUE', 80, footerY, { width: 180, align: 'center' });

    doc.fontSize(11)
       .fillColor('#0D1B2A')
       .font('Helvetica-Bold')
       .text(
         new Date(data.issuedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }),
         80, footerY + 14,
         { width: 180, align: 'center' }
       );

    // Signature line (center)
    doc.moveTo(W / 2 - 80, footerY + 30)
       .lineTo(W / 2 + 80, footerY + 30)
       .lineWidth(0.5)
       .stroke('#0D1B2A');

    doc.fontSize(9)
       .fillColor('#888888')
       .font('Helvetica')
       .text('AUTHORIZED SIGNATORY', W / 2 - 80, footerY + 34, { width: 160, align: 'center' });

    doc.fontSize(10)
       .fillColor('#0D1B2A')
       .font('Helvetica-Bold')
       .text('Registrar', W / 2 - 80, footerY + 47, { width: 160, align: 'center' });

    // QR code (right)
    doc.image(qrBuffer, W - 200, footerY - 8, { width: 80, height: 80 });
    doc.fontSize(7)
       .fillColor('#888888')
       .font('Helvetica')
       .text('Scan to verify', W - 200, footerY + 74, { width: 80, align: 'center' });

    // ── HASH STRIP ──
    doc.rect(20, H - 60, W - 40, 40).fill('#F2F0EC');

    doc.fontSize(7)
       .fillColor('#AAAAAA')
       .font('Helvetica')
       .text('BLOCKCHAIN VERIFICATION HASH', 60, H - 52, { width: W - 160 });

    doc.fontSize(7)
       .fillColor('#0D1B2A')
       .font('Helvetica')
       .text(data.hash, 60, H - 42, { width: W - 160 });

    if (data.blockchainTx) {
      doc.fontSize(7)
         .fillColor('#AAAAAA')
         .text(`TX: ${data.blockchainTx}`, 60, H - 32, { width: W - 160 });
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

/**
 * Get the public URL path for a certificate
 */
exports.getCertificateUrl = (hash) => {
  return `/uploads/certificates/certificate-${hash.slice(0, 16)}.pdf`;
};

/**
 * Check if certificate already exists
 */
exports.certificateExists = (hash) => {
  const fileName = `certificate-${hash.slice(0, 16)}.pdf`;
  return fs.existsSync(path.join(CERTIFICATES_DIR, fileName));
};
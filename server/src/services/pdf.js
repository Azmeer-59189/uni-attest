const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const CERTIFICATES_DIR = path.join(__dirname, '../../uploads/certificates');
const AMOY_POLYGONSCAN_URL = 'https://amoy.polygonscan.com';

if (!fs.existsSync(CERTIFICATES_DIR)) {
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
}

const getSafeHash = (hash) => hash.replace(/[^a-zA-Z0-9]/g, '');
const getChainHash = (hash) => hash.startsWith('0x') ? hash : `0x${hash}`;
const getPolygonscanSearchUrl = (hash) =>
  `${AMOY_POLYGONSCAN_URL}/search?f=0&q=${encodeURIComponent(getChainHash(hash))}`;

exports.generateCertificate = async (data, clientUrl = 'http://localhost:5173') => {
  const safeHash = getSafeHash(data.hash);
  const fileName = `certificate-${safeHash}.pdf`;
  const filePath = path.join(CERTIFICATES_DIR, fileName);

  const amoyLookupHash = data.blockchainTx || data.hash;
  const polygonscanSearchUrl = getPolygonscanSearchUrl(amoyLookupHash);

  const qrDataUrl = await QRCode.toDataURL(polygonscanSearchUrl, {
    width: 120,
    margin: 1,
    color: { dark: '#0D1B2A', light: '#FFFFFF' }
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
      bufferPages: true,  // buffer all pages so we can check count
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;   // 841.89
    const H = doc.page.height;  // 595.28

    // ── BACKGROUND ──
    doc.rect(0, 0, W, H).fill('#FAFAF8');

    // Navy border
    doc.rect(20, 20, W - 40, H - 40).lineWidth(3).stroke('#0D1B2A');

    // Inner gold border
    doc.rect(28, 28, W - 56, H - 56).lineWidth(1).stroke('#C9A84C');

    // ── HEADER BAND ──
    doc.rect(20, 20, W - 40, 80).fill('#0D1B2A');

    doc.fontSize(11).fillColor('#C9A84C').font('Helvetica')
       .text((data.university || 'UNIVERSITY').toUpperCase(), 0, 38, { align: 'center', width: W });

    doc.fontSize(8).fillColor('#D8D8D0')
       .text('DEGREE ATTESTATION PORTAL - UNIATTEST', 0, 58, { align: 'center', width: W });

    // ── GOLD DIVIDER ──
    doc.moveTo(60, 120).lineTo(W - 60, 120).lineWidth(1).stroke('#C9A84C');

    // ── TITLE ──
    doc.fontSize(11).fillColor('#C9A84C').font('Helvetica')
       .text('THIS IS TO CERTIFY THAT', 0, 135, { align: 'center', width: W });

    // ── STUDENT NAME ──
    doc.fontSize(36).fillColor('#0D1B2A').font('Helvetica-Bold')
       .text(data.studentName, 0, 158, { align: 'center', width: W });

    const nameWidth = doc.widthOfString(data.studentName);
    const nameX = (W - nameWidth) / 2;
    doc.moveTo(nameX, 200).lineTo(nameX + nameWidth, 200).lineWidth(0.5).stroke('#C9A84C');

    // ── BODY TEXT ──
    doc.fontSize(12).fillColor('#444444').font('Helvetica')
       .text(
         'having successfully completed all requirements, has been awarded the degree of',
         80, 215, { align: 'center', width: W - 160 }
       );

    // ── PROGRAM ──
    doc.fontSize(22).fillColor('#0D1B2A').font('Helvetica-Bold')
       .text(data.program, 0, 240, { align: 'center', width: W });

    // ── DEPARTMENT & YEAR ──
    doc.fontSize(11).fillColor('#666666').font('Helvetica')
       .text(
         `Department of ${data.department}  |  Graduation Year: ${data.graduationYear}${data.cgpa ? `  |  CGPA: ${data.cgpa}` : ''}`,
         0, 272, { align: 'center', width: W }
       );

    // ── GOLD DIVIDER ──
    doc.moveTo(60, 298).lineTo(W - 60, 298).lineWidth(1).stroke('#C9A84C');

    // ── FOOTER SECTION ──
    const footerY = 315;

    // Issue date (left)
    doc.fontSize(9).fillColor('#888888').font('Helvetica')
       .text('DATE OF ISSUE', 80, footerY, { width: 180, align: 'center' });
    doc.fontSize(11).fillColor('#0D1B2A').font('Helvetica-Bold')
       .text(
         new Date(data.issuedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }),
         80, footerY + 14, { width: 180, align: 'center' }
       );

    // Signature line (center)
    doc.moveTo(W / 2 - 80, footerY + 30).lineTo(W / 2 + 80, footerY + 30).lineWidth(0.5).stroke('#0D1B2A');
    doc.fontSize(9).fillColor('#888888').font('Helvetica')
       .text('AUTHORIZED SIGNATORY', W / 2 - 80, footerY + 34, { width: 160, align: 'center' });
    doc.fontSize(10).fillColor('#0D1B2A').font('Helvetica-Bold')
       .text('Registrar', W / 2 - 80, footerY + 47, { width: 160, align: 'center' });

    // QR code (right)
    doc.image(qrBuffer, W - 200, footerY - 8, { width: 80, height: 80 });
    doc.fontSize(7).fillColor('#888888').font('Helvetica')
       .text('Scan on Amoy', W - 200, footerY + 74, { width: 80, align: 'center' });

    const stripX = 60;
    const stripY = H - 86;
    const stripW = W - 120;
    const line1 = `Verification Hash: ${data.hash}`;
    const line2 = data.blockchainTx
      ? `Amoy Transaction: ${data.blockchainTx}`
      : 'Blockchain Transaction: Not available';

    doc.rect(stripX, stripY, stripW, 48).fill('#F1EFE6').stroke('#C9A84C');
    doc.fontSize(6.5).fillColor('#0D1B2A').font('Helvetica')
       .text(line1, stripX + 10, stripY + 18, { width: stripW - 20, lineBreak: false });

    doc.fontSize(6.5).fillColor('#0D1B2A').font('Helvetica')
       .text(line2, stripX + 10, stripY + 28, { width: stripW - 20, lineBreak: false });

    // Flush and end — only one page
    doc.flushPages();
    doc.end();

    stream.on('finish', () => {
      resolve(filePath);
    });
    stream.on('error', reject);
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

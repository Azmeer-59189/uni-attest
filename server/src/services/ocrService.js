const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const pdf = require('pdf-poppler');

async function pdfToImage(pdfPath) {
  const outputDir = os.tmpdir();
  const opts = {
    format: 'png',
    out_dir: outputDir,
    out_prefix: `ocr_pdf_${Date.now()}`,
    page: 1, // only first page
  };
  await pdf.convert(pdfPath, opts);
  // pdf-poppler outputs files like: prefix-1.png
  const outputFile = path.join(outputDir, `${opts.out_prefix}-1.png`);
  return outputFile;
}

async function preprocessImage(inputPath, isPdf) {
  const tmpPath = path.join(os.tmpdir(), `ocr_preprocessed_${Date.now()}.png`);
  let sourcePath = inputPath;

  // If PDF, convert to image first
  if (isPdf) {
    sourcePath = await pdfToImage(inputPath);
  }

  await sharp(sourcePath)
    .grayscale()
    .normalise()
    .sharpen()
    .resize({ width: 2000, withoutEnlargement: false })
    .png()
    .toFile(tmpPath);

  // Clean up the pdf-converted image if we made one
  if (isPdf) {
    await fs.unlink(sourcePath).catch(() => {});
  }

  return tmpPath;
}

async function extractRawText(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, 'eng', {
    logger: () => {},
  });
  return data.text;
}

function parseFields(text) {
  const result = {
    studentName: null, studentId: null, program: null,
    department: null, graduationYear: null, cgpa: null,
    university: null, confidence: {},
  };

  const namePatterns = [
    /(?:student\s*name|name)\s*[:\-]\s*([A-Za-z ]{3,40})/i,
    /(?:awarded\s+to|certifies\s+that|conferred\s+upon)\s+([A-Za-z ]{3,40})/i,
    /(?:mr\.|ms\.|miss\.|dr\.)\s+([A-Za-z ]{3,40})/i,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) { result.studentName = m[1].trim(); result.confidence.studentName = 'high'; break; }
  }

  const idPatterns = [
    /(?:student\s*id|roll\s*no|enrollment\s*no|reg(?:istration)?\s*no)\s*[:\-#]?\s*(\w{4,12})/i,
    /\b(\d{5,8})\b/,
  ];
  for (const pat of idPatterns) {
    const m = text.match(pat);
    if (m) { result.studentId = m[1].trim(); result.confidence.studentId = pat.source.includes('student') ? 'high' : 'low'; break; }
  }

  const programPatterns = [
    /(?:degree\s+of|program|degree|awarded)\s*[:\-]?\s*((?:BS|MS|MBA|BBA|BE|ME|PhD|Bachelor|Master|Software)[^\n,]{0,50})/i,
    /\b(Bachelor(?:\s+of\s+\w+){1,4})\b/i,
    /\b(Master(?:\s+of\s+\w+){1,4})\b/i,
    /\b(Software\s+Engineering)\b/i,
    /\b(BS\s*\([A-Za-z ]+\))\b/i,
    /\b(MBA|BBA|PhD)\b/i,
  ];
  for (const pat of programPatterns) {
    const m = text.match(pat);
    if (m) { result.program = m[1].trim(); result.confidence.program = 'high'; break; }
  }

  const deptPatterns = [
    /(?:department\s+of|department|dept)\s*[:\-]?\s*([A-Za-z ]{3,50})/i,
    /(?:faculty\s+of|school\s+of)\s*[:\-]?\s*([A-Za-z ]{3,50})/i,
  ];
  for (const pat of deptPatterns) {
    const m = text.match(pat);
    if (m) { result.department = m[1].trim(); result.confidence.department = 'high'; break; }
  }

  const yearPatterns = [
    /(?:graduation\s*year|grad\s*year|year\s+of\s+graduation|session|batch)\s*[:\-]?\s*(20\d{2})/i,
    /(?:awarded|issued|dated?)\s+(?:in\s+)?(20\d{2})/i,
  ];
  for (const pat of yearPatterns) {
    const m = text.match(pat);
    if (m) { result.graduationYear = parseInt(m[1]); result.confidence.graduationYear = 'high'; break; }
  }
  if (!result.graduationYear) {
    const years = [...text.matchAll(/\b(20[0-2]\d)\b/g)].map(m => parseInt(m[1]));
    if (years.length > 0) { result.graduationYear = Math.max(...years); result.confidence.graduationYear = 'low'; }
  }

  const cgpaPatterns = [
    /(?:cgpa|gpa|grade\s*point)\s*[:\-]?\s*(\d+\.\d{1,2})/i,
    /(\d+\.\d{2})\s*(?:\/\s*4\.00|out\s+of\s+4)/i,
  ];
  for (const pat of cgpaPatterns) {
    const m = text.match(pat);
    if (m) { result.cgpa = m[1].trim(); result.confidence.cgpa = 'high'; break; }
  }

  const uniPatterns = [
    /(?:university\s+of\s+[A-Za-z ]{3,30}|[A-Za-z ]{3,30}\s+university)/i,
    /(?:institute\s+of\s+[A-Za-z ]{3,30}|[A-Za-z ]{3,30}\s+institute)/i,
  ];
  for (const pat of uniPatterns) {
    const m = text.match(pat);
    if (m) { result.university = m[0].trim(); result.confidence.university = 'high'; break; }
  }

  Object.keys(result).forEach(k => {
    if (k === 'confidence') return;
    if (typeof result[k] === 'string') result[k] = result[k].replace(/\s+/g, ' ').trim() || null;
  });

  return result;
}

async function extractFromDocument(filePath, mimeType) {
  const start = Date.now();
  let preprocessedPath = null;
  const isPdf = mimeType === 'application/pdf';

  try {
    preprocessedPath = await preprocessImage(filePath, isPdf);
    const rawText = await extractRawText(preprocessedPath);
    const fields = parseFields(rawText);
    return { success: true, rawText, fields, processingTimeMs: Date.now() - start };
  } finally {
    if (preprocessedPath) await fs.unlink(preprocessedPath).catch(() => {});
  }
}

module.exports = { extractFromDocument };
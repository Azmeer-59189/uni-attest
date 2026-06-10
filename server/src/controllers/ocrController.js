const { extractFromDocument } = require('../services/ocrService');
const fs = require('fs').promises;

const extractDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;   // ← pass this

  try {
    const result = await extractFromDocument(filePath, mimeType);
    res.json({
      success: true,
      message: 'Document processed successfully',
      data: {
        fields: result.fields,
        rawText: result.rawText,
        processingTimeMs: result.processingTimeMs,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      },
    });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'OCR processing failed', details: err.message });
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
};

module.exports = { extractDocument };
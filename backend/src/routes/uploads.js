const express = require('express');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

const router = express.Router();

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_TEXT_CHARS = 50_000;          // cap prompt payload

function requireWriteRole(req, res, next) {
  if (!['owner', 'recruiter'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
  }
  return next();
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || '').trim());
  if (!match) {
    return null;
  }
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

function normalizeText(raw) {
  const text = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > MAX_TEXT_CHARS) {
    return text.slice(0, MAX_TEXT_CHARS) + '\n\n[…tekst afgekapt op ' + MAX_TEXT_CHARS + ' tekens]';
  }
  return text;
}

// POST /api/uploads/extract-text — Word/PDF-bestand → platte tekst
router.post('/extract-text', requireWriteRole, async (req, res, next) => {
  try {
    const decoded = decodeDataUrl(req.body?.dataUrl);
    if (!decoded) {
      return res.status(400).json({ error: 'Bestandsdata ontbreekt of is ongeldig.' });
    }

    if (decoded.buffer.length > MAX_FILE_BYTES) {
      return res.status(413).json({ error: 'Bestand is te groot (max 8 MB).' });
    }

    const filename = String(req.body?.filename || '').trim().slice(0, 255) || 'document';
    const lowerName = filename.toLowerCase();

    const isDocx =
      decoded.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.docx');
    const isPdf = decoded.mimeType === 'application/pdf' || lowerName.endsWith('.pdf');

    let text = '';
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: decoded.buffer });
      text = normalizeText(result.value);
    } else if (isPdf) {
      const parser = new PDFParse({ data: decoded.buffer });
      const result = await parser.getText();
      text = normalizeText(result.text);
    } else {
      return res.status(415).json({
        error: 'Alleen Word (.docx) en PDF (.pdf) worden ondersteund.',
      });
    }

    if (!text) {
      return res.status(422).json({
        error: 'Er kon geen leesbare tekst uit het bestand worden gehaald.',
      });
    }

    return res.json({ filename, text, chars: text.length });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

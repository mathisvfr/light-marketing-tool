const fs = require('node:fs/promises');
const path = require('node:path');

async function loadPrompt(name) {
  const promptPath = path.resolve(__dirname, '../../prompts', `${name}.md`);

  try {
    const raw = await fs.readFile(promptPath, 'utf8');
    return raw;
  } catch (_error) {
    throw new Error(`Prompt ${name} kon niet worden geladen.`);
  }
}

async function loadBrandKnowledge() {
  const candidates = [
    path.resolve(__dirname, '../../brand', 'brand-knowledge.md'),
    path.resolve(__dirname, '../../../brand', 'brand-knowledge.md'),
  ];

  for (const filePath of candidates) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (_e) {
      // try next candidate
    }
  }

  return '';
}

module.exports = {
  loadPrompt,
  loadBrandKnowledge,
};

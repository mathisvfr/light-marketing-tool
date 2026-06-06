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

module.exports = {
  loadPrompt,
};

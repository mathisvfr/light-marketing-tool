const { supabase } = require('../db/client');
const { loadPrompt } = require('./prompts');

const MODEL = 'claude-sonnet-4-20250514';

async function loadBrandContext() {
  const { data, error } = await supabase.from('brand_settings').select('key, value').order('key');

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return 'Geen merkcontext gevonden.';
  }

  const lines = data.map((item) => `- ${item.key}: ${item.value}`);
  return ['# Merkcontext', ...lines].join('\n');
}

function extractTextFromAnthropicResponse(responseJson) {
  const text = responseJson?.content?.find((item) => item.type === 'text')?.text;

  if (!text) {
    throw new Error('Geen tekst ontvangen van Anthropic API.');
  }

  return text.trim();
}

function parseJsonOrThrow(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (_error) {
    throw new Error('Anthropic gaf geen geldige JSON terug.');
  }
}

async function callAnthropic(systemPrompt, formData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY ontbreekt in .env');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(formData),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('Anthropic API gaf een fout tijdens genereren.');
  }

  return response.json();
}

const PROMPT_BY_TYPE = {
  'marketing-post': 'marketing-post',
  'seo-page': 'seo-page',
  vacature: 'vacature',
};

async function generate(type, formData) {
  const promptName = PROMPT_BY_TYPE[type] || 'vacature';
  const [brandContext, templatePrompt] = await Promise.all([
    loadBrandContext(),
    loadPrompt(promptName),
  ]);

  const systemPrompt = `${brandContext}\n\n${templatePrompt}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const responseJson = await callAnthropic(systemPrompt, formData);
    const rawText = extractTextFromAnthropicResponse(responseJson);

    try {
      return parseJsonOrThrow(rawText);
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error('Genereren mislukte door ongeldige JSON-respons.');
}

module.exports = {
  loadBrandContext,
  generate,
};

const { supabase } = require('../db/client');
const { loadPrompt } = require('./prompts');

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_GREENPT_MODEL = 'green-r-raw';
const DEFAULT_GREENPT_API_URL = 'https://api.greenpt.ai/v1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiModelCandidates() {
  const primary = String(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
  const fallback = String(process.env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_FALLBACK_MODEL).trim();

  return Array.from(new Set([primary, fallback].filter(Boolean)));
}

function getProvider() {
  const explicit = String(process.env.AI_PROVIDER || '').trim().toLowerCase();

  if (explicit) {
    return explicit;
  }

  if (process.env.GREENPT_API_KEY) {
    return 'greenpt';
  }

  if (process.env.GOOGLE_AI_STUDIO_API_KEY) {
    return 'gemini';
  }

  return 'anthropic';
}

function getProviderLabel(provider) {
  if (provider === 'gemini') {
    return 'Gemini';
  }

  if (provider === 'greenpt') {
    return 'GreenPT';
  }

  return 'Anthropic';
}

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
    throw new Error('AI-provider gaf geen geldige JSON terug.');
  }
}

async function callAnthropic(systemPrompt, formData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

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
      model,
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
    const errorBody = await response.text();
    if (errorBody) {
      throw new Error(`Anthropic API gaf een fout tijdens genereren: ${errorBody}`);
    }

    throw new Error('Anthropic API gaf een fout tijdens genereren.');
  }

  return response.json();
}

function extractTextFromGeminiResponse(responseJson) {
  const text =
    responseJson?.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part?.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim() || '';

  if (!text) {
    throw new Error('Geen tekst ontvangen van Gemini API.');
  }

  return text;
}

function extractTextFromOpenAiCompatResponse(responseJson, providerLabel) {
  const message = responseJson?.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error(`Geen tekst ontvangen van ${providerLabel} API.`);
}

async function callGreenPt(systemPrompt, payload) {
  const apiKey = process.env.GREENPT_API_KEY;
  const model = String(process.env.GREENPT_MODEL || DEFAULT_GREENPT_MODEL).trim();
  const apiBaseUrl = String(process.env.GREENPT_API_URL || DEFAULT_GREENPT_API_URL).trim().replace(/\/$/, '');

  if (!apiKey) {
    throw new Error('GREENPT_API_KEY ontbreekt in .env');
  }

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error('GreenPT API-sleutel is ongeldig of heeft geen toegang.');
    }

    if (response.status === 429) {
      throw new Error('GreenPT rate limit bereikt. Probeer over enkele seconden opnieuw.');
    }

    if (errorBody) {
      throw new Error(`GreenPT API gaf een fout tijdens genereren: ${errorBody}`);
    }

    throw new Error('GreenPT API gaf een fout tijdens genereren.');
  }

  return response.json();
}

async function callGemini(systemPrompt, payload) {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  const models = getGeminiModelCandidates();

  if (!apiKey) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY ontbreekt in .env');
  }

  let lastError = null;
  let unavailableCount = 0;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: JSON.stringify(payload) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1400,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        return response.json();
      }

      const errorBody = await response.text();

      let parsed = null;
      try {
        parsed = JSON.parse(errorBody);
      } catch (_parseError) {
        parsed = null;
      }

      const status = parsed?.error?.status;
      const message = parsed?.error?.message;
      const isUnavailable = response.status === 503 || status === 'UNAVAILABLE';

      if (response.status === 401 || response.status === 403) {
        throw new Error('Gemini API-sleutel is ongeldig of heeft geen toegang tot dit model.');
      }

      if (isUnavailable && attempt === 0) {
        await sleep(1200);
        continue;
      }

      if (response.status === 429 || status === 'RESOURCE_EXHAUSTED') {
        lastError = new Error(
          `Gemini quota is bereikt voor model ${model}. Controleer limieten en billing in Google AI Studio.`
        );
      } else if (isUnavailable) {
        unavailableCount += 1;
        lastError = new Error(
          `Gemini model ${model} is tijdelijk overbelast. Probeer het over enkele seconden opnieuw.`
        );
      } else if (message) {
        lastError = new Error(`Gemini API gaf een fout tijdens genereren (${model}): ${message}`);
      } else if (errorBody) {
        lastError = new Error(`Gemini API gaf een fout tijdens genereren (${model}): ${errorBody}`);
      } else {
        lastError = new Error(`Gemini API gaf een fout tijdens genereren (${model}).`);
      }

      break;
    }

    const hasNextCandidate = index < models.length - 1;
    if (!hasNextCandidate) {
      if (unavailableCount >= models.length) {
        throw new Error(
          'Gemini is tijdelijk overbelast (2.5 Flash en 2.5 Flash Lite). Probeer opnieuw over enkele seconden.'
        );
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Gemini API gaf een fout tijdens genereren.');
}

async function callProvider(provider, systemPrompt, payload) {
  if (provider === 'greenpt') {
    const responseJson = await callGreenPt(systemPrompt, payload);
    return extractTextFromOpenAiCompatResponse(responseJson, 'GreenPT');
  }

  if (provider === 'gemini') {
    const responseJson = await callGemini(systemPrompt, payload);
    return extractTextFromGeminiResponse(responseJson);
  }

  const responseJson = await callAnthropic(systemPrompt, payload);
  return extractTextFromAnthropicResponse(responseJson);
}

async function callAnthropicExpectingJson(systemPrompt, payload) {
  const provider = getProvider();

  if (!['anthropic', 'gemini', 'greenpt'].includes(provider)) {
    throw new Error('AI_PROVIDER moet "anthropic", "gemini" of "greenpt" zijn.');
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rawText = await callProvider(provider, systemPrompt, payload);

    try {
      return parseJsonOrThrow(rawText);
    } catch (error) {
      if (attempt === 1) {
        throw new Error(`${getProviderLabel(provider)} gaf geen geldige JSON terug.`);
      }
    }
  }

  throw new Error('Genereren mislukte door ongeldige JSON-respons.');
}

async function generate(type, formData) {
  const promptName =
    type === 'marketing-post' ? 'marketing-post' : type === 'seo-page' ? 'seo-page' : 'vacature';
  const [brandContext, templatePrompt] = await Promise.all([
    loadBrandContext(),
    loadPrompt(promptName),
  ]);

  const systemPrompt = `${brandContext}\n\n${templatePrompt}`;

  return callAnthropicExpectingJson(systemPrompt, formData);
}

async function criticus(input) {
  const [brandContext, criticusPrompt] = await Promise.all([
    loadBrandContext(),
    loadPrompt('criticus'),
  ]);

  const systemPrompt = `${brandContext}\n\n${criticusPrompt}`;
  const result = await callAnthropicExpectingJson(systemPrompt, input);

  return {
    passed: Boolean(result?.passed),
    notes: String(result?.notes || '').trim(),
  };
}

module.exports = {
  loadBrandContext,
  generate,
  criticus,
};

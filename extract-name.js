// extract-name.js
const { genAI } = require('./gemini');

function normalizeFirst(word) {
  if (!word) return null;
  // remove pontuação solta, conserva acentos, pega só a 1ª palavra válida
  const clean = word.replace(/[^A-Za-zÀ-ÿ\s'-]/g, ' ').trim();
  const first = clean.split(/\s+/)[0];
  if (!first) return null;
  // Diego, João, Átila...
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

async function extractFirstName(texto) {
  const prompt =
`Retorne APENAS o primeiro nome próprio presente na mensagem abaixo.
- Se não houver nome claro, responda exatamente: null
- Não adicione comentários.
Mensagem: """${texto}"""`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const res = await model.generateContent(prompt);
    const out = (res.response.text() || '').trim();

    if (!out || out.toLowerCase() === 'null') return null;
    // corta qualquer coisa além do primeiro token de nome e normaliza
    return normalizeFirst(out);
  } catch (e) {
    console.error('❌ extractFirstName:', e.message);
    return null;
  }
}

module.exports = { extractFirstName };

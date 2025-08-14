// gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY não definido no .env');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = { genAI };

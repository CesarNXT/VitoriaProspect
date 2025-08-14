require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const emojiRegex = require('emoji-regex');

const folderAudios = path.join(process.cwd(), 'audios');
if (!fs.existsSync(folderAudios)) fs.mkdirSync(folderAudios);

function stripEmojis(text) { const rx = emojiRegex(); return (text || '').replace(rx, '').trim(); }

async function gerarAudioEPublicar(texto, numero) {
  texto = stripEmojis(texto || '');
  const filename = `resposta-${(numero || '').replace(/\D/g, '')}-${Date.now()}.mp3`;
  const outputPath = path.join(folderAudios, filename);
  const python = process.env.PYTHON_COMMAND || 'python';
  const script = path.join(__dirname, 'generate_audio_fish.py');

  return new Promise((resolve, reject) => {
    const p = spawn(python, [script, texto, outputPath], { timeout: 30000 });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', code => {
      if (code === 0) {
        const ogg = outputPath.replace('.mp3', '.ogg');
        if (fs.existsSync(ogg)) resolve(ogg); else reject(new Error('OGG não gerado.'));
      } else { console.error('❌ TTS STDERR:', stderr); reject(new Error(`TTS falhou (${code})`)); }
    });
    p.on('error', reject);
  });
}

module.exports = { gerarAudioEPublicar };

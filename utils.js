const fs = require('fs');
const path = require('path');

// Lê um JSON relativo ao projeto
function readJSON(relPath) {
  const p = path.resolve(__dirname, relPath);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

// Template simples: {{chave}}
function tmpl(str, vars) {
  return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

// Lê leads.csv com cabeçalho: nome,numero,segmento
function readLeadsCSV(relPath) {
  const p = path.resolve(__dirname, relPath);
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim());
  const idxNome = header.indexOf('nome');
  const idxNumero = header.indexOf('numero');
  const idxSegmento = header.indexOf('segmento');
  if (idxNome === -1 || idxNumero === -1 || idxSegmento === -1) {
    throw new Error('Cabeçalho do CSV deve conter: nome,numero,segmento');
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.trim());
    rows.push({
      nome: cols[idxNome],
      numero: cols[idxNumero],
      segmento: cols[idxSegmento],
    });
  }
  return rows;
}

// Saudação usando timezone America/Recife
function saudacaoRecife(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Recife'
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour').value);
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

module.exports = {
  readJSON,
  tmpl,
  readLeadsCSV,
  saudacaoRecife, // <- exportada corretamente
};

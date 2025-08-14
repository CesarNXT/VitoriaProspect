// lead_state.js
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(process.cwd(), 'state');
const STATE_FILE = path.join(STATE_DIR, 'leads_status.json');

function ensureFile() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));
}

function loadAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function saveAll(obj) {
  ensureFile();
  fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2));
}

function getLeadKey(numero) {
  return (numero || '').replace(/\D/g, '') || 'sem_numero';
}

function getLeadState(numero) {
  const all = loadAll();
  const k = getLeadKey(numero);
  return all[k] || null;
}

function setLeadState(numero, state) {
  const all = loadAll();
  const k = getLeadKey(numero);
  all[k] = state;
  saveAll(all);
  return all[k];
}

function patchLeadState(numero, patch) {
  const cur = getLeadState(numero) || {};
  return setLeadState(numero, { ...cur, ...patch });
}

module.exports = {
  getLeadState,
  setLeadState,
  patchLeadState,
  getLeadKey,
};

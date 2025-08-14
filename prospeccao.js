// prospeccao.js
const readline = require('readline');
const { responderRapport } = require('./agente_rapport');
const { responderVendas } = require('./agente_vendas');
const { extractFirstName } = require('./extract-name');
const { getLeadState, setLeadState, patchLeadState } = require('./lead_state');

// Config da API Gemini
const MODEL = process.env.GEMINI_MODEL || process.env.GEM_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;

// Follow-up timeout (ms) depois de enviar o áudio de vendas
const FOLLOWUP_MS = Number(process.env.FOLLOWUP_MS || 60_000);

// ---- Detectores de BOT / menus automatizados ----
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?:;()\[\]'"“”‘’\-_/\\|]+/g, '')
    .trim();
}

function isLikelyMenu(text) {
  const t = normalize(text);
  const menuPhrases = [
    'escolha uma opcao',
    'escolher uma opcao',
    'digite o numero',
    'nao entendi sua opcao',
    'nao entendi a sua opcao',
    'selecione uma opcao',
    'menu',
    'opcoes',
    'opcao'
  ];
  if (menuPhrases.some(p => t.includes(p))) return true;
  const lines = t.split(/\n/);
  const numbered = lines.filter(l => /^\s*\d+\s*[-–—]/.test(l)).length;
  if (numbered >= 2) return true;
  if (/\b1\s*[-–—]?\s*\w+.*\b2\s*[-–—]?\s*\w+/.test(t)) return true;
  return false;
}

function isLikelyBotResponse(current, prev) {
  if (normalize(current) && normalize(current) === normalize(prev)) return true;
  if (isLikelyMenu(current)) return true;
  return false;
}

// ---- Chamada ao Gemini ----
async function callGemini(systemInstruction, history) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${API_KEY}`;
  const body = { system_instruction: { parts: [{ text: systemInstruction }] }, contents: history };
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) { const t = await resp.text().catch(() => ''); throw new Error(`HTTP ${resp.status} - ${t}`); }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '(sem resposta)';
}

/**
 * Fluxo principal
 * stage:
 *  - 'rapport'                 -> fazendo perguntas simples
 *  - 'await_bot_human'         -> pausado aguardando humano (anti-bot)
 *  - 'vendas_waiting'          -> áudio enviado, aguardando resposta do cliente
 *  - 'vendas_followup_sent'    -> follow-up enviado
 *  - 'vendas_active'           -> cliente respondeu após áudio; conversando
 *  - 'closed'                  -> encerrado
 */
async function iniciarProspeccao({ empresa, segmento, numero }) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY não definido no .env');

  // Carrega / cria estado do lead
  const initialState = getLeadState(numero) || {
    empresa, segmento, numero,
    stage: 'rapport',
    perguntasFeitas: 0,
    nomeContato: null,
    timestamps: {}
  };
  setLeadState(numero, initialState);

  let { stage, nomeContato, perguntasFeitas } = initialState;
  let agenteAtual = stage.startsWith('vendas') ? 'vendas' : 'rapport';
  let waitingForHuman = stage === 'await_bot_human';
  let lastUserMsg = null;
  let followupTimer = null;

  const history = [];
  const addUser = (text) => history.push({ role: 'user', parts: [{ text }] });
  const addAssistant = (text) => history.push({ role: 'model', parts: [{ text }] });

  console.log(`\n🎯 Lead: ${empresa} | Segmento: ${segmento}\n`);

  // Se já está em vendas esperando, NÃO reinicia rapport
  if (agenteAtual === 'rapport') {
    try {
      const r = await responderRapport({ empresa, segmento, history, perguntasFeitas, callGemini }, { type: 'init' });
      if (r.message) { addAssistant(r.message); console.log(`Vitória (Rapport): ${r.message}`); }
      perguntasFeitas = r.perguntasFeitas ?? perguntasFeitas;
      patchLeadState(numero, { stage: 'rapport', perguntasFeitas });
    } catch (e) {
      console.error('Falha inicial:', e.message);
    }
  } else {
    console.log('↪️ Estado indica que já estamos na fase de VENDAS. Aguardando mensagens do cliente…');
    if (stage === 'vendas_waiting') {
      // agenda follow-up se ainda não foi enviado
      agendarFollowup();
    }
  }

  function agendarFollowup() {
    clearFollowup();
    followupTimer = setTimeout(async () => {
      try {
        // Só manda follow-up se ainda estamos esperando
        const s = getLeadState(numero);
        if (!s || s.stage !== 'vendas_waiting') return;
        const rv = await responderVendas({ empresa, segmento, nomeContato: s.nomeContato, numero, history, callGemini }, { type: 'followup_timeout' });
        if (rv.message) {
          addAssistant(rv.message);
          console.log(`Vitória (Vendas - Follow-up): ${rv.message}`);
        }
        patchLeadState(numero, { stage: 'vendas_followup_sent', timestamps: { ...s.timestamps, followup_at: Date.now() } });
      } catch (e) {
        console.error('Erro no follow-up:', e.message);
      }
    }, FOLLOWUP_MS);
  }

  function clearFollowup() {
    if (followupTimer) {
      clearTimeout(followupTimer);
      followupTimer = null;
    }
  }

  // CLI
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Você: ' });
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();

    // Anti-bot local
    const looksBot = isLikelyBotResponse(input, lastUserMsg);
    lastUserMsg = input;

    if (looksBot) {
      if (!waitingForHuman) {
        waitingForHuman = true;
        console.log('🤖 Detectei possível chatbot do outro lado. Pausando e aguardando humano…');
        patchLeadState(numero, { stage: 'await_bot_human' });
      } else {
        console.log('⏸️ Ainda parece chatbot. Continuo aguardando humano…');
      }
      rl.prompt();
      return;
    } else if (waitingForHuman) {
      waitingForHuman = false;
      console.log('🟢 Recebi uma mensagem que parece humana. Retomando o fluxo.');
      // se estávamos esperando humano, volte ao stage anterior ou siga normal
      const s = getLeadState(numero) || {};
      const newStage = s.stage === 'await_bot_human' ? (agenteAtual === 'rapport' ? 'rapport' : 'vendas_active') : s.stage;
      patchLeadState(numero, { stage: newStage });
    }

    // A partir daqui, vale como mensagem do cliente (adiciona ao histórico)
    addUser(input);

    // Extrai nome uma vez
    if (!nomeContato) {
      try {
        const n = await extractFirstName(input);
        if (n) {
          nomeContato = n;
          console.log(`🧠 Nome detectado: ${nomeContato}`);
          patchLeadState(numero, { nomeContato });
        }
      } catch (e) {
        console.error('extractFirstName falhou:', e.message);
      }
    }

    try {
      if (agenteAtual === 'rapport') {
        const r = await responderRapport({ empresa, segmento, history, perguntasFeitas, nomeContato, callGemini }, { type: 'user_message', text: input });

        if (r.handoff === true || r.proximoAgente === 'vendas') {
          nomeContato = r.nomeContato || nomeContato;
          agenteAtual = 'vendas';
          console.log('🔁 Transferindo para Vendas…');

          const rv = await responderVendas({ empresa, segmento, nomeContato, numero, history, callGemini }, { type: 'init' });
          if (rv.message) { addAssistant(rv.message); console.log(`Vitória (Vendas): ${rv.message}`); }
          patchLeadState(numero, {
            stage: 'vendas_waiting',
            nomeContato,
            timestamps: { ...(getLeadState(numero)?.timestamps || {}), pitch_sent_at: Date.now() }
          });
          // agenda follow-up de 1 min
          agendarFollowup();
        } else {
          perguntasFeitas = r.perguntasFeitas ?? perguntasFeitas;
          if (r.message) { addAssistant(r.message); console.log(`Vitória (Rapport): ${r.message}`); }
          patchLeadState(numero, { stage: 'rapport', perguntasFeitas, nomeContato: nomeContato || undefined });
        }
      } else {
        // Vendas: qualquer mensagem cancela follow-up, ativa conversa
        clearFollowup();
        patchLeadState(numero, { stage: 'vendas_active' });

        const rv = await responderVendas({ empresa, segmento, nomeContato, numero, history, callGemini }, { type: 'user_message', text: input });
        if (rv.message) { addAssistant(rv.message); console.log(`Vitória (Vendas): ${rv.message}`); }

        if (rv.encerrar === true) {
          patchLeadState(numero, { stage: 'closed', timestamps: { ...(getLeadState(numero)?.timestamps || {}), closed_at: Date.now() } });
          console.log('✅ Fluxo encerrado.');
          rl.close();
        }
      }
    } catch (e) {
      console.error('Erro:', e.message);
    }

    rl.prompt();
  });

  rl.on('SIGINT', () => {
    console.log('\nEncerrando. Até mais!');
    process.exit(0);
  });
}

module.exports = { iniciarProspeccao, callGemini };

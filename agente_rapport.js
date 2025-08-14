// Agente de Rapport: abre conversa, faz até 3 perguntas específicas do segmento,
// depois pede o nome e encerra o rapport para handoff.
// Mantém respostas curtas (<=350 chars), 1 pergunta por vez, sem emojis, sem revelar IA.

const { readJSON, tmpl, saudacaoRecife } = require('./utils');

// Monta a instrução de sistema a partir do JSON e das variáveis
function systemRapport(empresa, segmento) {
  const data = readJSON('prompts/rapport.json'); // { prompt: "..." }
  const saudacao = saudacaoRecife(); // Bom dia | Boa tarde | Boa noite (America/Recife)
  return tmpl(data.prompt, { empresa, segmento, saudacao });
}

/**
 * Heurística leve: detecta se a saída aparenta ser uma PERGUNTA
 * (termina com ? ou contém um marcador típico de pergunta em PT-BR).
 */
function parecePergunta(texto) {
  if (!texto) return false;
  const t = texto.trim();
  if (/\?\s*$/.test(t)) return true; // termina com ?
  // alguns padrões comuns:
  if (/(como|quando|onde|qual|quais|fazem|oferecem|trabalham|atendem|aceitam|tem|têm)\s/i.test(t)) {
    // só conta se for curta e com entonação de pergunta
    return true;
  }
  return false;
}

/**
 * Heurística leve: detecta se a IA já pediu o nome (para ajudar fluxo).
 */
function parecePedirNome(texto) {
  if (!texto) return false;
  const t = texto.toLowerCase();
  return /com quem estou falando|seu nome|qual o seu nome|quem está falando|posso saber seu nome/.test(t);
}

/**
 * responderRapport(ctx, evt)
 * - ctx: { empresa, segmento, history, perguntasFeitas, nomeContato, callGemini }
 * - evt: { type: 'init' | 'user_message', text? }
 *
 * Retorna: { message?, perguntasFeitas?, handoff?, proximoAgente?, nomeContato? }
 */
async function responderRapport(ctx, evt) {
  const { empresa, segmento, history, callGemini } = ctx;
  let { perguntasFeitas = 0, nomeContato = null } = ctx;

  const system = systemRapport(empresa, segmento);

  // 1) Inicialização: primeira fala obrigatória (usa {{saudacao}} e empresa)
  if (evt.type === 'init') {
    history.push({
      role: 'user',
      parts: [{
        text:
          `Inicie o rapport agora para a empresa ${empresa} (segmento ${segmento}). ` +
          `Siga a ordem: confirmar empresa → até 3 perguntas específicas do segmento (1 por vez) → pedir o nome.`
      }]
    });

    const out = await callGemini(system, history);
    return { message: out, perguntasFeitas };
  }

  // 2) Se já temos o nome no contexto (o orquestrador extraiu do usuário), faz handoff
  if (nomeContato) {
    return {
      handoff: true,
      proximoAgente: 'vendas',
      nomeContato
    };
  }

  // 3) Dica de fluxo para o modelo (controle de perguntas antes de pedir nome)
  const hint = (perguntasFeitas < 3)
    ? `Faça mais uma pergunta específica de ${segmento} (você já fez ${perguntasFeitas}). ` +
      `A pergunta deve ser única, direta e curta.`
    : `Agora peça o nome de quem responde ("Com quem estou falando?") e finalize o rapport para transferir.`;

  // empurra uma "mensagem do usuário" que serve como *nudge* de planejamento
  history.push({ role: 'user', parts: [{ text: hint }] });

  // 4) Chama o Gemini com o histórico + system
  const out = await callGemini(system, history);

  // 5) Atualiza o contador:
  //    - se ainda estamos na fase de perguntas e a saída parece pergunta, incrementa
  //    - se já é a fase de pedir nome, não incrementa
  if (perguntasFeitas < 3) {
    if (parecePergunta(out) && !parecePedirNome(out)) {
      perguntasFeitas += 1;
    }
  }

  return { message: out, perguntasFeitas };
}

module.exports = { responderRapport };

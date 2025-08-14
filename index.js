// index.js
require('dotenv').config();

const { iniciarProspeccao } = require('./prospeccao');
const { readLeadsCSV } = require('./utils');

(async () => {
  try {
    const leads = readLeadsCSV('leads.csv');
    if (!leads.length) {
      console.log('Nenhum lead no CSV.');
      console.log('Formato obrigatório do CSV: nome,numero,segmento');
      console.log('Ex.: Top Fades Barbearia,5581999999999,barbearia');
      process.exit(0);
    }

    // pegue o primeiro lead (ou selecione por índice)
    const lead = leads[0];
    const empresa = lead.nome;
    const numero = lead.numero;
    const segmento = lead.segmento;

    console.log('🚀 Iniciando simulação de prospecção no terminal…');
    await iniciarProspeccao({ empresa, segmento, numero });
  } catch (e) {
    console.error('Falha ao iniciar:', e.message);
    process.exit(1);
  }
})();

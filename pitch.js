// pitch.js
const { gerarAudioEPublicar } = require('./tts-service');

// Texto oficial do pitch (com inserção do nome)
function montarPitchTexto(nome) {
  const nomeOk = (nome || '').toString().trim();
  const saudacaoNome = nomeOk ? `Oi ${nomeOk},` : 'Oi,';
  return `${saudacaoNome} se eu te dissesse que você tá falando com uma IA… acreditaria?
Pois é. E o que tô fazendo agora é exatamente o que posso fazer no WhatsApp da sua empresa.
Eu cuido do WhatsApp da empresa como se fosse uma funcionária real:
atendo os clientes com simpatia, apresento produtos ou serviços, faço agendamentos, envio lembretes, acompanho se a pessoa vai comparecer, se precisa remarcar… e até se desistiu.
Ah! E não me limito só a texto, viu?
Eu entendo áudio, imagem e até PDF.
Sou treinada para entender o seu segmento e, com o tempo, fico cada vez mais inteligente e personalizada.
E se em algum momento eu não souber o que fazer, sem problema: eu escalo direto pra alguém da sua equipe.
O melhor? Eu trabalho 24 horas por dia, 7 dias por semana, sem pausa, sem férias, sem atraso.
Se você quer transformar o atendimento da sua empresa em algo profissional, rápido e eficiente…
eu sou a parceira ideal pra isso 💡
Me dá uma oportunidade de te mostrar na prática?`;
}

// Gera o áudio do pitch e retorna { texto, oggPath }
async function gerarPitchAudio(numero, nome) {
  const texto = montarPitchTexto(nome);
  const oggPath = await gerarAudioEPublicar(texto, numero);
  return { texto, oggPath };
}

module.exports = { montarPitchTexto, gerarPitchAudio };

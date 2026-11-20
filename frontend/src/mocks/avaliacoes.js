// DADOS DE EXEMPLO: enquanto não há backend/Google Form, as avaliações do site ficam no localStorage
// deste navegador, nesta chave. Prazos do "não perguntar de novo" são provisórios (a loja pode ajustar).
export const CHAVE_AVALIACOES = 'aquarilandia-avaliacoes-site'

export const LEMBRETE_EXEMPLO = {
  diasAposEnvio: 90, // quem já avaliou não vê a aba lateral por ~3 meses
  diasAposDispensa: 7, // quem clicou em "Agora não" não vê a aba por 1 semana
}

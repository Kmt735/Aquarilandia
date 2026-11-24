// Avaliação do SITE (experiência de navegação) e textos comuns às avaliações de produto.
export const NOTAS = [1, 2, 3, 4, 5]

export const ROTULO_NOTA = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Razoável',
  4: 'Boa',
  5: 'Excelente',
}

export const MOTIVOS_VISITA = [
  ['comprar', 'Comprar'],
  ['conhecer-peixes', 'Conhecer os peixes'],
  ['aprender-aquario', 'Aprender a montar um aquário'],
  ['orcamento', 'Pedir orçamento'],
  ['outro', 'Outro'],
]

export const ENCONTROU = [
  ['sim', 'Sim'],
  ['mais-ou-menos', 'Mais ou menos'],
  ['nao', 'Não'],
]

export const LIMITE_COMENTARIO = 300

// Agradecimento depois de enviar (site e produto). A API diz se a avaliação já foi publicada ou espera a loja conferir
export const MSG_PENDENTE = 'Obrigado! Sua avaliação aparece no site depois que a loja conferir.'
export const MSG_PUBLICADA = 'Obrigado! Sua avaliação foi publicada.'

// Situação da avaliação na moderação (mesmos valores da API)
export const STATUS_AVALIACAO = { pendente: 'Pendente', aprovada: 'Aprovada', oculta: 'Oculta' }

// "Não perguntar de novo" (aba lateral). Prazos provisórios: a loja pode ajustar
export const LEMBRETE_AVALIACAO = {
  diasAposEnvio: 90, // quem já avaliou não vê a aba lateral por ~3 meses
  diasAposDispensa: 7, // quem clicou em "Agora não" não vê a aba por 1 semana
}

// DADOS DE EXEMPLO — regra provisória do backend (docs/decisoes.md D-29), "até a loja confirmar":
// entrega local em São João del Rei com frete fixo e prazo de 1 dia útil; retirada na loja com frete zero.
// A faixa de CEP abaixo é de EXEMPLO e precisa ser confirmada.
export const FRETE_EXEMPLO = {
  faixaCepLocal: [36300000, 36309999],
  valorLocal: 10,
  prazoLocal: '1 dia útil',
  prazoRetirada: 'a combinar com a loja',
}

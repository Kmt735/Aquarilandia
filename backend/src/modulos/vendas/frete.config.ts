// VALORES PROVISÓRIOS E ILUSTRATIVOS — substituir pelos da loja (#4). Só este arquivo muda quando a loja confirmar.
// Dinheiro em centavos (D-04); CEP sempre com 8 dígitos, sem máscara.

export interface FaixaCep {
  cepInicio: string
  cepFim: string
  valor: number
  prazoDias: number
}

export interface FaixaBrasil extends FaixaCep {
  nome: string
}

export interface ConfigFrete {
  categoriaPeixe: string
  prazoRetiradaDias: number
  saoJoaoDelRei: Readonly<FaixaCep>
  faixasBrasil: readonly Readonly<FaixaBrasil>[]
  freteGratisAcima: number | null
}

// Slug da categoria de peixe vivo (categorias.slug): só é entregue em São João del Rei
export const categoriaPeixe = 'peixes'

export const prazoRetiradaDias = 1

// Faixa a confirmar nos Correios
export const saoJoaoDelRei: Readonly<FaixaCep> = {
  cepInicio: '36300000',
  cepFim: '36309999',
  valor: 1000,
  prazoDias: 1,
}

// Uma faixa por primeiro dígito do CEP, de 01000000 a 99999999, sem buraco nem sobreposição
export const faixasBrasil: readonly Readonly<FaixaBrasil>[] = [
  { nome: 'São Paulo (capital e região)', cepInicio: '01000000', cepFim: '09999999', valor: 3000, prazoDias: 5 },
  { nome: 'São Paulo (interior)', cepInicio: '10000000', cepFim: '19999999', valor: 3000, prazoDias: 5 },
  { nome: 'Rio de Janeiro e Espírito Santo', cepInicio: '20000000', cepFim: '29999999', valor: 3000, prazoDias: 5 },
  { nome: 'Minas Gerais', cepInicio: '30000000', cepFim: '39999999', valor: 2500, prazoDias: 4 },
  { nome: 'Bahia e Sergipe', cepInicio: '40000000', cepFim: '49999999', valor: 4000, prazoDias: 7 },
  {
    nome: 'Pernambuco, Alagoas, Paraíba e Rio Grande do Norte',
    cepInicio: '50000000',
    cepFim: '59999999',
    valor: 4500,
    prazoDias: 8,
  },
  {
    nome: 'Ceará, Piauí, Maranhão e Região Norte',
    cepInicio: '60000000',
    cepFim: '69999999',
    valor: 5500,
    prazoDias: 10,
  },
  { nome: 'Centro-Oeste, Tocantins e Rondônia', cepInicio: '70000000', cepFim: '79999999', valor: 4000, prazoDias: 7 },
  { nome: 'Paraná e Santa Catarina', cepInicio: '80000000', cepFim: '89999999', valor: 3500, prazoDias: 6 },
  { nome: 'Rio Grande do Sul', cepInicio: '90000000', cepFim: '99999999', valor: 4000, prazoDias: 7 },
]

// null = sem frete grátis
export const freteGratisAcima: number | null = null

export const configFrete: Readonly<ConfigFrete> = {
  categoriaPeixe,
  prazoRetiradaDias,
  saoJoaoDelRei,
  faixasBrasil,
  freteGratisAcima,
}

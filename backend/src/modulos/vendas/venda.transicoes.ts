import type { StatusVenda } from './venda.types.js'

// Mesmos valores do CHECK de historico_status_venda.origem (db/init/20_vendas.sql)
export type AtorVenda = 'cliente' | 'admin' | 'sistema' | 'gateway'

// Espelha o CHECK ck_historico_status_venda_alterado_por: cliente e admin sempre têm o id de quem mudou;
// sistema e gateway nunca têm. Com a união, o TypeScript recusa a combinação que o banco recusaria.
export type AutoriaVenda =
  | { ator: 'cliente' | 'admin'; clienteId: number; observacao?: string | null }
  | { ator: 'sistema' | 'gateway'; clienteId: null; observacao?: string | null }

type DestinosPermitidos = Readonly<Partial<Record<StatusVenda, readonly AtorVenda[]>>>

// A tabela de transições é DADO: para cada status de origem, os destinos possíveis e quem pode levar a venda
// até lá. O que não está aqui é proibido, inclusive ir de um status para ele mesmo.
// entregue e cancelada são finais (sem destinos).
// Toda venda paga passa por cancelamento_solicitado antes de cancelada (revisão de 24/10, D-11 e D-17).
//
// Ficam FORA desta tabela, porque dependem de dados da venda e não só do status (#35 e #41):
//   - enviada só para correios/propria e pronta_retirada só para retirada (tipo_entrega);
//   - o admin só conclui cancelamento_solicitado → cancelada depois de 5 tentativas de estorno
//     (pagamentos.estorno_tentativas).
const transicoes: Readonly<Record<StatusVenda, DestinosPermitidos>> = {
  aguardando_pagamento: {
    paga: ['gateway'],
    cancelada: ['cliente', 'admin', 'sistema'],
  },
  paga: {
    em_separacao: ['admin'],
    cancelamento_solicitado: ['cliente', 'admin'],
  },
  em_separacao: {
    enviada: ['admin'],
    pronta_retirada: ['admin'],
    cancelamento_solicitado: ['cliente', 'admin'],
  },
  enviada: {
    entregue: ['admin'],
  },
  pronta_retirada: {
    entregue: ['admin'],
    cancelamento_solicitado: ['cliente', 'admin'],
  },
  cancelamento_solicitado: {
    cancelada: ['sistema', 'admin'],
  },
  entregue: {},
  cancelada: {},
}

export function podeTransicionar(de: StatusVenda, para: StatusVenda, ator: AtorVenda): boolean {
  // hasOwn: um valor fora do tipo vindo de fora (ex.: '__proto__') não alcança o protótipo do objeto
  if (!Object.hasOwn(transicoes, de)) return false
  const destinos = transicoes[de]
  if (!Object.hasOwn(destinos, para)) return false
  return destinos[para]?.includes(ator) ?? false
}

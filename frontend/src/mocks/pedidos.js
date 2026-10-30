// DADOS DE EXEMPLO — compras fictícias para visualizar "Minhas compras" e a linha do tempo de status
const agora = Date.now()
const dias = (n) => new Date(agora - n * 86400000).toISOString()

export const PEDIDOS_EXEMPLO = [
  {
    id: 'EX-1003',
    criadoEm: dias(0.1),
    status: 'em_separacao',
    entrega: { tipo: 'endereco', resumo: 'Rua de Exemplo, 100 · São João del Rei/MG', frete: 10 },
    itens: [
      { id: 'betta-splendens', nome: 'Betta Splendens', tipo: 'peixe', categoria: 'Peixes', preco: 20, qtd: 1 },
      { id: 'racao-flocos-premium', nome: 'Ração Flocos Premium', tipo: 'produto', categoria: 'Rações', preco: 18.5, qtd: 2 },
    ],
    historico: [
      { status: 'aguardando_pagamento', em: dias(0.12) },
      { status: 'paga', em: dias(0.11) },
      { status: 'em_separacao', em: dias(0.1) },
    ],
    rastreio: null,
  },
  {
    id: 'EX-1002',
    criadoEm: dias(6),
    status: 'enviada',
    entrega: { tipo: 'endereco', resumo: 'Avenida de Exemplo, 200 · Belo Horizonte/MG', frete: null },
    itens: [{ id: 'filtro-externo-hw-302', nome: 'Filtro Externo HW-302', tipo: 'produto', categoria: 'Filtros', preco: 189, qtd: 1 }],
    historico: [
      { status: 'aguardando_pagamento', em: dias(6.2) },
      { status: 'paga', em: dias(6.1) },
      { status: 'em_separacao', em: dias(5) },
      { status: 'enviada', em: dias(4) },
    ],
    rastreio: 'CODIGO-DE-EXEMPLO',
  },
  {
    id: 'EX-1001',
    criadoEm: dias(30),
    status: 'cancelamento_solicitado',
    entrega: { tipo: 'retirada', resumo: 'Retirada na loja', frete: 0 },
    itens: [{ id: 'aquario-vidro-40l', nome: 'Aquário Vidro 40L', tipo: 'produto', categoria: 'Aquários', preco: 249.9, qtd: 1 }],
    historico: [
      { status: 'aguardando_pagamento', em: dias(30.2) },
      { status: 'paga', em: dias(30.1) },
      { status: 'cancelamento_solicitado', em: dias(29) },
    ],
    rastreio: null,
  },
]

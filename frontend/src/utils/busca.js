import { categorias } from '../data/categorias'
import { peixes } from '../data/peixes'
import { produtos } from '../data/produtos'
import { formatarPreco, normalizar } from './format'
import { ROTAS, urlLoja } from './rotas'

export const indiceBusca = [
  ...produtos.map((p) => ({
    tipo: 'Produto',
    rotulo: p.nome,
    sub: `${p.categoria} · ${formatarPreco(p.preco)}`,
    icone: p.icone,
    to: urlLoja({ categoria: p.categoria }),
    state: { destaque: p.id },
  })),
  ...peixes.map((p) => ({
    tipo: 'Peixe',
    rotulo: p.nome,
    sub: p.cientifico,
    icone: '🐟',
    to: ROTAS.peixes,
    state: { destaque: p.id },
  })),
  ...categorias.map((c) => ({
    tipo: 'Categoria',
    rotulo: c.nome,
    sub: 'Ver produtos da categoria',
    icone: '📂',
    to: urlLoja({ categoria: c.nome }),
  })),
  {
    tipo: 'Página',
    rotulo: 'Meu Primeiro Aquário',
    sub: 'Guia passo a passo para iniciantes',
    icone: '📘',
    to: ROTAS.primeiroAquario,
  },
  {
    tipo: 'Página',
    rotulo: 'Serviços e orçamento',
    sub: 'Montagem, manutenção, plantados, empresas',
    icone: '🧰',
    to: ROTAS.servicos,
  },
]

export function buscar(consulta) {
  const termo = normalizar(consulta.trim())
  if (!termo) return indiceBusca.filter((i) => i.tipo === 'Página')
  return indiceBusca.filter((i) => normalizar(`${i.rotulo} ${i.sub}`).includes(termo)).slice(0, 8)
}

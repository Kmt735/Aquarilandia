import { categorias } from '../data/categorias'
import { descricaoCategoria } from '../data/glossario'
import { todosPeixes, todosProdutos } from '../services/catalogo'
import { formatarPreco, normalizar } from './format'
import { ROTAS, urlLoja, urlPeixe, urlProduto } from './rotas'

export const indiceBusca = [
  ...todosProdutos().map((p) => ({ tipo: 'Produto', rotulo: p.nome, sub: `${p.categoria} · ${formatarPreco(p.preco)}`, to: urlProduto(p.id) })),
  ...todosPeixes().map((p) => ({ tipo: 'Peixe', rotulo: p.nome, sub: `${p.cientifico} · ${formatarPreco(p.preco)}`, to: urlPeixe(p.id) })),
  ...categorias.map((c) => ({ tipo: 'Categoria', rotulo: c.nome, sub: descricaoCategoria[c.nome], to: urlLoja({ categoria: c.nome }) })),
  { tipo: 'Página', rotulo: 'Meu Primeiro Aquário', sub: 'Guia passo a passo para iniciantes', to: ROTAS.primeiroAquario },
  { tipo: 'Página', rotulo: 'Serviços e orçamento', sub: 'Montagem, manutenção, plantados, empresas', to: ROTAS.servicos },
  { tipo: 'Página', rotulo: 'Perguntas frequentes', sub: 'Entrega, trocas e formas de pagamento', to: ROTAS.perguntas },
]

export function buscar(consulta) {
  const termo = normalizar(consulta.trim())
  if (!termo) return indiceBusca.filter((i) => i.tipo === 'Página')
  return indiceBusca.filter((i) => normalizar(`${i.rotulo} ${i.sub}`).includes(termo)).slice(0, 8)
}

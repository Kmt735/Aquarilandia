import { descricaoCategoria } from '../data/glossario.js'
import { listarCategorias, listarPeixes, listarProdutos } from '../services/catalogo.js'
import { formatarPreco, normalizar } from './format.js'
import { ROTAS, urlCategoria, urlItem } from './rotas.js'

const PAGINAS = [
  { tipo: 'Página', rotulo: 'Meu Primeiro Aquário', sub: 'Guia passo a passo para iniciantes', to: ROTAS.primeiroAquario },
  { tipo: 'Página', rotulo: 'Serviços e orçamento', sub: 'Montagem, manutenção, plantados, empresas', to: ROTAS.servicos },
  { tipo: 'Página', rotulo: 'Perguntas frequentes', sub: 'Entrega, trocas e formas de pagamento', to: ROTAS.perguntas },
]

export async function buscar(consulta) {
  const termo = normalizar(consulta.trim())
  if (!termo) return PAGINAS
  const [produtos, peixes, categorias] = await Promise.all([
    listarProdutos({ busca: consulta, limite: 8 }), listarPeixes({ busca: consulta, limite: 8 }), listarCategorias(),
  ])
  // O mesmo ID pode aparecer nos dois endpoints; a ficha de peixe tem prioridade.
  const itens = [...new Map([...produtos.itens, ...peixes.itens].map((p) => [p.id, p])).values()]
  return [
    ...itens.map((p) => ({ tipo: p.tipo === 'peixe' ? 'Peixe' : 'Produto', rotulo: p.nome,
      sub: `${p.cientifico ?? p.categoria} · ${formatarPreco(p.preco, { centavos: true })}`, to: urlItem(p) })),
    ...categorias.filter((c) => normalizar(c.nome).includes(termo)).map((c) => ({ tipo: 'Categoria', rotulo: c.nome, sub: descricaoCategoria[c.nome], to: urlCategoria(c) })),
    ...PAGINAS.filter((p) => normalizar(`${p.rotulo} ${p.sub}`).includes(termo)),
  ].slice(0, 8)
}

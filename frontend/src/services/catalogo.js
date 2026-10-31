// Catálogo: transforma os dados locais (src/data, sem mudar o formato) no formato que os componentes usam.
// INTEGRAÇÃO: trocar listar*/obter* por GET /api/produtos e GET /api/peixes (preço em centavos → formatarPreco({ centavos: true })).
import { peixes } from '../data/peixes'
import { produtos } from '../data/produtos'
import { ESTOQUE_EXEMPLO, LIMITE_ENCOMENDA_EXEMPLO } from '../mocks/catalogo'
import { ErroApi, simularRede } from './http'

export const PRAZO_ENCOMENDA = 'a definir com a loja'
const SEM_DADO = new Set(['', 'x', '-', '?'])

const dadoReal = (valor) => (valor == null || SEM_DADO.has(String(valor).trim().toLowerCase()) ? null : valor)

// "Doce · 28-30°C" → { tipoAgua: 'Doce', temperatura: '28–30 °C' }
function lerAgua(agua) {
  if (!agua) return { tipoAgua: null, temperatura: null }
  const [tipo, temp] = agua.split('·').map((p) => p.trim())
  const temperatura = temp ? temp.replace(/(\d)\s*-\s*(\d)/, '$1–$2').replace(/\s*°C/, ' °C') : null
  return { tipoAgua: tipo || null, temperatura }
}

// "●○○ Fácil" → { nivel: 1, rotulo: 'Fácil' }
function lerDificuldade(texto) {
  if (!texto) return null
  const nivel = (texto.match(/●/g) ?? []).length
  return { nivel, rotulo: texto.replace(/[●○]/g, '').trim() }
}

// Separa o "evite ..." que já está escrito no texto do "Combina com" (caso do Betta) — nada é inventado
function lerCompatibilidade(texto) {
  if (!texto) return { combinaCom: [], evitarCom: [] }
  const [combina, evite] = texto.split(/;\s*evite\s+/i)
  const lista = (t) =>
    t
      ? t
          .split(/,|\s+e\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      : []
  return { combinaCom: lista(combina), evitarCom: lista(evite) }
}

const litros = (texto) => Number(String(texto ?? '').replace(/\D/g, '')) || null

function normalizarPeixe(p) {
  const estoque = ESTOQUE_EXEMPLO[p.id] ?? null
  const { tipoAgua, temperatura } = lerAgua(p.agua)
  const dificuldade = lerDificuldade(p.dificuldade)
  const aquarioMinimo = litros(p.aquarioMinimo)
  const disponibilidade = !p.disponivel || estoque === 0 ? 'esgotado' : 'disponivel'

  return {
    id: p.id,
    tipo: 'peixe',
    nome: p.nome,
    cientifico: p.cientifico,
    categoria: 'Peixes',
    descricao: p.descricao,
    preco: p.preco ?? null,
    imagens: p.foto ? [{ src: p.foto, alt: `Foto de ${p.nome}` }] : [],
    disponibilidade,
    estoque: disponibilidade === 'esgotado' ? 0 : estoque,
    entregaLocal: true, // peixe vivo: entrega só em São João del Rei
    ficha: {
      tipoAgua,
      temperatura,
      ph: dadoReal(p.ph),
      temperamento: p.temperamento ?? null,
      aquarioMinimo,
      tamanhoAdulto: p.tamanhoAdulto ?? null,
      dificuldade,
      cores: p.cores ?? null,
    },
    ...lerCompatibilidade(p.compativelCom),
    filtros: {
      agua: p.caracteristicas?.salgada ? 'salgada' : 'doce',
      temperamento: p.temperamento ?? null,
      dificuldade: dificuldade?.rotulo ?? null,
    },
    chips: [
      p.temperamento && { id: 'temperamento', rotulo: p.temperamento, titulo: 'Temperamento' },
      aquarioMinimo && { id: 'aquario', rotulo: `Mín. ${aquarioMinimo} L`, titulo: 'Aquário mínimo' },
      temperatura && { id: 'temperatura', rotulo: temperatura, titulo: 'Temperatura da água' },
    ].filter(Boolean),
  }
}

function normalizarProduto(p) {
  const disponibilidade = p.emEstoque ? 'disponivel' : 'encomenda'
  const chipUtil = p.volumeLitros
    ? { id: 'volume', rotulo: `${p.volumeLitros} L`, titulo: 'Volume do aquário' }
    : p.capacidadeMaxLitros
      ? { id: 'capacidade', rotulo: `Até ${p.capacidadeMaxLitros} L`, titulo: 'Atende aquários de até' }
      : { id: 'categoria', rotulo: p.categoria, titulo: 'Categoria' }

  return {
    id: p.id,
    tipo: 'produto',
    nome: p.nome,
    cientifico: null,
    categoria: p.categoria,
    descricao: p.descricao,
    preco: p.preco,
    precoOriginal: p.precoOriginal ?? null,
    imagens: p.foto ? [{ src: p.foto, alt: p.nome }] : [],
    disponibilidade,
    estoque: p.emEstoque ? (ESTOQUE_EXEMPLO[p.id] ?? null) : LIMITE_ENCOMENDA_EXEMPLO,
    prazoEncomenda: p.emEstoque ? null : PRAZO_ENCOMENDA,
    entregaLocal: false,
    volumeLitros: p.volumeLitros ?? null,
    capacidadeMaxLitros: p.capacidadeMaxLitros ?? null,
    chips: [chipUtil],
  }
}

export const todosPeixes = () => peixes.map(normalizarPeixe)
export const todosProdutos = () => produtos.map(normalizarProduto)

export async function listarPeixes() {
  await simularRede()
  return todosPeixes()
}

export async function listarProdutos() {
  await simularRede()
  return todosProdutos()
}

export async function obterPeixe(id) {
  await simularRede()
  const peixe = peixes.find((p) => p.id === id)
  if (!peixe) throw new ErroApi('Peixe não encontrado.', {}, 404)
  return normalizarPeixe(peixe)
}

export async function obterProduto(id) {
  await simularRede()
  const produto = produtos.find((p) => p.id === id)
  if (!produto) throw new ErroApi('Produto não encontrado.', {}, 404)
  return normalizarProduto(produto)
}

// Uso síncrono (busca do cabeçalho e comparação): mesmos dados normalizados
export const encontrarItem = (id) =>
  todosProdutos().find((p) => p.id === id) ?? todosPeixes().find((p) => p.id === id) ?? null

// INTEGRAÇÃO: POST /api/avise-me (rota ainda não existe no backend)
export async function aviseMe({ itemId, email }) {
  await simularRede(500)
  return { itemId, email }
}

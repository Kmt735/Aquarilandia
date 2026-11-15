// DADOS DE DEMONSTRAÇÃO — não são produtos, preços nem estoque reais da loja.
// Responde no MESMO formato da API (backend/api.md): envelope { itens, total }, preço em centavos,
// categoria pelo slug, `ficha` só no detalhe de produtos e na lista/detalhe de peixes.
// Ligado apenas com VITE_CATALOGO_MOCK=true (src/config/ambiente.js). Quando o banco tiver produtos,
// basta desligar a chave: nenhum componente muda. Estes dados podem virar um seed do backend.
//
// Campos que a API ainda NÃO tem e que este mock acrescenta:
//   TODO(API): `estoque` (quantidade) — a API só expõe `emEstoque`.
//   TODO(API): `ficha.dados.incompativelCom` (IDs de espécies incompatíveis) — não existe no banco.
import { ErroApi, simularRede } from '../services/http.js'

const CATEGORIAS = [
  ['Peixes', 'peixes'], ['Aquários', 'aquarios'], ['Filtros', 'filtros'], ['Bombas', 'bombas'],
  ['Iluminação', 'iluminacao'], ['Termostatos', 'termostatos'], ['Rações', 'racoes'],
  ['Condicionadores e medicamentos', 'condicionadores'], ['Substratos', 'substratos'], ['Plantas', 'plantas'],
  ['Decorações', 'decoracoes'], ['Acessórios', 'acessorios'],
].map(([nome, slug], i) => ({ id: i + 1, nome, slug }))

const idCategoria = (slug) => CATEGORIAS.find((c) => c.slug === slug).id

// [id, slug, nome, preço (centavos), estoque, descrição, dados da ficha]
const aquario = (volumeLitros, comprimentoCm, larguraCm, alturaCm, tipoAgua = 'ambos', material = 'vidro') =>
  ({ volumeLitros, comprimentoCm, larguraCm, alturaCm, material, tipoAgua })
const filtro = (tipo, vazaoLh, aquarioMaxLitros, potenciaW) => ({ tipo, vazaoLh, aquarioMaxLitros, potenciaW, voltagem: 'bivolt', midiasInclusas: null })
const termostato = (potenciaW, aquarioMinLitros, aquarioMaxLitros) => ({ potenciaW, aquarioMinLitros, aquarioMaxLitros, tempMinC: 20, tempMaxC: 32, ajustavel: true, voltagem: 'bivolt' })
const luminaria = (potenciaW, comprimentoCm, espectro) => ({ tecnologia: 'led', potenciaW, comprimentoCm, espectro, temperaturaCorK: 6500, voltagem: 'bivolt' })
const substrato = (tipo, pesoKg, cor, alteraPh = false) => ({ tipo, pesoKg, granulometriaMm: null, cor, alteraPh })
const decoracao = (material, materialNatural, seguroMarinho, comprimentoCm) => ({ material, materialNatural, comprimentoCm, larguraCm: null, alturaCm: null, seguroMarinho })
const planta = (nome, posicao, iluminacaoExigida, precisaCo2, tempMinC, tempMaxC, dificuldade = 'iniciante') =>
  ({ nome, posicao, iluminacaoExigida, precisaCo2, crescimento: 'medio', dificuldade, tempMinC, tempMaxC })
const peixe = (nomeCientifico, tipoAgua, tamanhoAdultoCm, tempMinC, tempMaxC, aquarioMinLitros, temperamento, cardumeMinimo, dificuldade, incompativelCom = []) => ({
  nomeCientifico, origem: null, tipoAgua, tamanhoAdultoCm, tempMinC, tempMaxC, phMin: 6, phMax: 7.5, aquarioMinLitros,
  aquarioMaxLitros: null, temperamento, nivelNatacao: 'meio', cardumeMinimo, dieta: 'onivoro', dificuldade, incompativelCom,
})

const PRODUTOS = [
  [101, 'aquarios', 'Aquário de vidro 20 L', 12990, 5, 'Compacto, bom para um Betta ou um pequeno cardume.', aquario(20, 40, 20, 25)],
  [102, 'aquarios', 'Aquário de vidro 40 L', 24990, 3, 'O tamanho mais procurado para começar.', aquario(40, 50, 25, 32)],
  [103, 'aquarios', 'Aquário de vidro 75 L', 39990, 2, 'Mais espaço para cardumes e plantas.', aquario(75, 60, 30, 42)],
  [104, 'aquarios', 'Aquário de vidro 150 L', 79990, 1, 'Para peixes maiores, como o Acará Disco.', aquario(150, 100, 40, 38)],
  [105, 'aquarios', 'Aquário marinho 90 L', 129900, 1, 'Vidro extra claro, preparado para água salgada.', aquario(90, 60, 40, 38, 'marinho')],
  [106, 'aquarios', 'Aquário de acrílico 30 L', 19990, 0, 'Leve e resistente a batidas.', aquario(30, 45, 25, 27, 'ambos', 'acrilico')],
  [201, 'filtros', 'Filtro interno mini', 4990, 8, 'Para aquários de até 30 L.', filtro('interno', 200, 30, 3)],
  [202, 'filtros', 'Filtro hang-on 60 L', 8990, 6, 'Fica pendurado na borda; fácil de limpar.', filtro('hang_on', 400, 60, 5)],
  [203, 'filtros', 'Filtro hang-on 120 L', 14990, 4, 'Mais vazão para aquários médios.', filtro('hang_on', 800, 120, 8)],
  [204, 'filtros', 'Filtro externo canister 300 L', 49990, 2, 'Silencioso, com várias mídias de filtragem.', filtro('canister', 1200, 300, 15)],
  [301, 'termostatos', 'Termostato com aquecedor 25 W', 5990, 6, 'Para aquários de 10 a 30 L.', termostato(25, 10, 30)],
  [302, 'termostatos', 'Termostato com aquecedor 50 W', 7990, 5, 'Para aquários de 30 a 60 L.', termostato(50, 30, 60)],
  [303, 'termostatos', 'Termostato com aquecedor 100 W', 9990, 4, 'Para aquários de 60 a 120 L.', termostato(100, 60, 120)],
  [304, 'termostatos', 'Termostato com aquecedor 200 W', 13990, 2, 'Para aquários de 120 a 250 L.', termostato(200, 120, 250)],
  [401, 'iluminacao', 'Luminária LED 40 cm', 8990, 5, 'Luz branca para aquários pequenos.', luminaria(8, 40, 'branco')],
  [402, 'iluminacao', 'Luminária LED 50 cm', 11990, 4, 'Luz branca, com suporte ajustável.', luminaria(12, 50, 'branco')],
  [403, 'iluminacao', 'Luminária LED plantado 60 cm', 18990, 3, 'Espectro forte, para plantas exigentes.', luminaria(24, 60, 'plantado')],
  [404, 'iluminacao', 'Luminária LED 100 cm', 32990, 2, 'Para aquários grandes.', luminaria(36, 100, 'branco')],
  [405, 'iluminacao', 'Luminária LED marinha 60 cm', 45990, 0, 'Espectro azul para aquário marinho.', luminaria(40, 60, 'marinho')],
  [501, 'substratos', 'Areia branca 5 kg', 3990, 20, 'Fina e clara, não altera a água.', substrato('areia', 5, 'branca')],
  [502, 'substratos', 'Cascalho natural 5 kg', 3490, 15, 'Pedrinhas médias, fáceis de limpar.', substrato('cascalho', 5, 'bege')],
  [503, 'substratos', 'Substrato fértil 2 kg', 6990, 10, 'Base com nutrientes para as plantas enraizarem.', substrato('fertil', 2, 'marrom')],
  [504, 'substratos', 'Areia de coral 5 kg', 5990, 6, 'Para aquário marinho: ajuda a manter o pH alto.', substrato('coral', 5, 'branca', true)],
  [601, 'decoracoes', 'Kit de pedras de rio', 4490, 8, 'Pedras lisas e lavadas.', decoracao('pedra', true, true, 15)],
  [602, 'decoracoes', 'Tronco natural', 6990, 4, 'Madeira tratada; solta taninos e deixa a água amarelada no começo.', decoracao('tronco', true, false, 30)],
  [603, 'decoracoes', 'Castelo de resina', 3990, 5, 'Enfeite com tocas para os peixes se esconderem.', decoracao('resina', false, true, 12)],
  [604, 'decoracoes', 'Vaso de cerâmica', 2990, 0, 'Esconderijo para peixes de fundo.', decoracao('ceramica', false, false, 10)],
  [701, 'plantas', 'Anúbias nana', 2490, 10, 'Resistente e de crescimento lento. Cresce presa em pedras ou troncos.', planta('Anubias barteri var. nana', 'epifita', 'baixa', false, 22, 28)],
  [702, 'plantas', 'Musgo de Java', 1990, 12, 'Forma um tapete verde sobre pedras e troncos.', planta('Taxiphyllum barbieri', 'epifita', 'baixa', false, 18, 30)],
  [703, 'plantas', 'Elódea', 1290, 15, 'Cresce rápido e ajuda a deixar a água limpa.', planta('Egeria densa', 'fundo', 'media', false, 15, 26)],
  [704, 'plantas', 'Glossostigma', 2990, 6, 'Forma um gramado no chão do aquário.', planta('Glossostigma elatinoides', 'frente', 'alta', true, 22, 26, 'avancado')],
  [801, 'peixes', 'Néon Cardinal', 890, 30, 'Pequeno, colorido e calmo. Vive em cardume.', peixe('Paracheirodon axelrodi', 'doce', 4, 24, 29, 40, 'pacifico', 6, 'intermediario')],
  [802, 'peixes', 'Betta', 2000, 4, 'Nadadeiras longas; os machos brigam entre si.', peixe('Betta splendens', 'doce', 6.5, 24.5, 28.5, 20, 'semi_agressivo', 1, 'iniciante', [803])],
  [803, 'peixes', 'Guppy', 790, 25, 'Ativo e fácil de cuidar.', peixe('Poecilia reticulata', 'doce', 5, 22, 28, 30, 'pacifico', 3, 'iniciante', [802])],
  [804, 'peixes', 'Corydoras', 1490, 18, 'Vive no fundo e ajuda a limpar restos de ração.', peixe('Corydoras paleatus', 'doce', 6, 22, 26, 60, 'pacifico', 4, 'iniciante')],
  [805, 'peixes', 'Acará Disco', 14990, 6, 'Lindo e exigente com a qualidade da água.', peixe('Symphysodon spp.', 'doce', 18, 28, 31, 150, 'pacifico', 4, 'avancado')],
  [806, 'peixes', 'Kinguio Oranda', 3990, 5, 'Peixe de água fria; cresce bastante.', peixe('Carassius auratus', 'doce', 15, 18, 22, 80, 'pacifico', 1, 'iniciante')],
  [807, 'peixes', 'Oscar', 5990, 2, 'Grande e territorial: come peixes menores.', peixe('Astronotus ocellatus', 'doce', 30, 22, 28, 300, 'agressivo', 1, 'intermediario')],
  [808, 'peixes', 'Peixe-palhaço', 8990, 3, 'O peixe marinho mais famoso.', peixe('Amphiprion ocellaris', 'marinho', 9, 24, 27, 80, 'semi_agressivo', 1, 'intermediario')],
  [809, 'peixes', 'Platy', 690, 20, 'Tranquilo, colorido e resistente.', peixe('Xiphophorus maculatus', 'doce', 5, 20, 26, 40, 'pacifico', 3, 'iniciante')],
  [810, 'peixes', 'Baiacu-verde', 4990, 2, 'Vive em água salobra e pode morder nadadeiras.', peixe('Dichotomyctere nigroviridis', 'salobra', 15, 24, 28, 100, 'semi_agressivo', 1, 'avancado')],
  [811, 'peixes', 'Kinguio Ranchu', 4590, 0, 'Sem nadadeira dorsal, nada devagar.', peixe('Carassius auratus', 'doce', 15, 18, 22, 80, 'pacifico', 1, 'iniciante')],
  [901, 'racoes', 'Ração em flocos 50 g', 1990, 30, 'Para peixes tropicais de água doce.', { formato: 'flocos', pesoG: 50, tipoAgua: 'doce', indicadaPara: 'Peixes tropicais' }],
  [902, 'condicionadores', 'Condicionador de água 100 mL', 2990, 25, 'Tira o cloro da água da torneira.', { tipo: 'condicionador', volumeMl: 100, dosagem: '1 mL para 10 L', principioAtivo: null, tipoAgua: 'ambos' }],
]

const BASE = PRODUTOS.map(([id, slug, nome, preco, estoque, descricao, dados]) => ({
  id, categoriaId: idCategoria(slug), categoria: slug, nome, descricao, marca: 'Demonstração', preco, imagemUrl: null,
  emEstoque: estoque > 0, estoque, ativo: true, ficha: { tipo: slug, dados },
}))
// A loja pública só enxerga itens ativos (como a API)
const publicos = () => BASE.filter((p) => p.ativo)

// a listagem de /produtos não traz ficha (só o detalhe), como a API real
const semFicha = (p) => Object.fromEntries(Object.entries(p).filter(([campo]) => campo !== 'ficha'))
const naoEncontrado = () => { throw new ErroApi('Item não encontrado.', {}, 404) }
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function paginar(itens, { pagina = 1, limite = 20 }) {
  const p = Number(pagina)
  const l = Number(limite)
  return { itens: itens.slice((p - 1) * l, p * l), total: itens.length }
}

function filtrar(itens, parametros) {
  let lista = itens
  if (parametros.busca) {
    const termo = normalizar(parametros.busca)
    lista = lista.filter((p) => normalizar(`${p.nome} ${p.descricao ?? ''}`).includes(termo))
  }
  if (parametros.categoria) lista = lista.filter((p) => p.categoria === parametros.categoria)
  if (parametros.preco_min != null) lista = lista.filter((p) => p.preco >= Number(parametros.preco_min))
  if (parametros.preco_max != null) lista = lista.filter((p) => p.preco <= Number(parametros.preco_max))
  if (parametros.em_estoque) lista = lista.filter((p) => String(p.emEstoque) === parametros.em_estoque)
  for (const campo of ['tipo_agua', 'temperamento', 'dificuldade']) {
    const chave = campo === 'tipo_agua' ? 'tipoAgua' : campo
    if (parametros[campo]) lista = lista.filter((p) => p.ficha?.dados[chave] === parametros[campo])
  }
  const ordem = parametros.ordem ?? 'nome'
  const fator = ordem.startsWith('-') ? -1 : 1
  const campo = ordem.replace('-', '')
  return [...lista].sort((a, b) => (campo === 'preco' ? (a.preco - b.preco) * fator : a.nome.localeCompare(b.nome, 'pt-BR')) || a.id - b.id)
}

/** Mesma assinatura de consultarApi (services/api-publica.js). */
/** Mesma assinatura de consultarApi (services/api-publica.js). */
export async function consultarMock(caminho, parametros = {}) {
  await simularRede(250)
  const [, recurso, id] = caminho.split('/')
  if (recurso === 'categorias') return paginar(CATEGORIAS, parametros)
  if (recurso === 'produtos') {
    if (id) return structuredClone(publicos().find((p) => p.id === Number(id)) ?? naoEncontrado())
    return paginar(filtrar(publicos(), parametros).map(semFicha), parametros)
  }
  if (recurso === 'peixes') {
    const peixes = publicos().filter((p) => p.categoria === 'peixes')
    if (id) return structuredClone(peixes.find((p) => p.id === Number(id)) ?? naoEncontrado())
    return structuredClone(paginar(filtrar(peixes, parametros), parametros))
  }
  throw new ErroApi('Não foi possível consultar o catálogo.', {}, 404)
}
// ===== ADMIN (demonstração): mexe só em memória; ao recarregar a página, volta ao original =====
let proximoId = 9001
const itemAdmin = (id) => BASE.find((p) => p.id === Number(id)) ?? naoEncontrado()

export const adminMock = {
  async listar({ ativo, ...parametros }) {
    await simularRede(250)
    let lista = filtrar(BASE, parametros)
    if (ativo) lista = lista.filter((p) => String(p.ativo) === ativo)
    return paginar(lista.map(semFicha), parametros)
  },
  async obter(id) {
    await simularRede(200)
    return structuredClone(itemAdmin(id))
  },
  async criar(dados) {
    await simularRede(350)
    const categoria = CATEGORIAS.find((c) => c.id === dados.categoriaId)
    if (!categoria) throw new ErroApi('Dados inválidos.', { categoria: 'Escolha a categoria.' }, 400)
    const novo = {
      id: proximoId++, categoriaId: categoria.id, categoria: categoria.slug, nome: dados.nome,
      descricao: dados.descricao ?? null, marca: dados.marca ?? null, preco: dados.preco,
      imagemUrl: dados.imagemUrl ?? null, emEstoque: false, estoque: 0, ativo: true, ficha: dados.ficha ?? null,
    }
    BASE.push(novo)
    return structuredClone(novo)
  },
  async editar(id, dados) {
    await simularRede(350)
    const item = itemAdmin(id)
    if (!item.ativo) naoEncontrado() // como na API: editar item fora da loja dá 404
    for (const campo of ['nome', 'descricao', 'marca', 'preco', 'imagemUrl']) {
      if (campo in dados) item[campo] = dados[campo]
    }
    if (dados.ficha) item.ficha = dados.ficha
    return structuredClone(item)
  },
  async desativar(id) {
    await simularRede(250)
    const item = itemAdmin(id)
    if (!item.ativo) naoEncontrado()
    item.ativo = false
    return null
  },
  async reativar(id) {
    await simularRede(250)
    const item = itemAdmin(id)
    item.ativo = true
    return structuredClone(item)
  },
}

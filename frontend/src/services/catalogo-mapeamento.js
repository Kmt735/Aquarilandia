import { ErroApi } from './http.js'

export const AGUA = { doce: 'Doce', salobra: 'Salobra', marinho: 'Salgada', ambos: 'Doce e salgada' }
export const TEMPERAMENTO = { pacifico: 'Pacífico', semi_agressivo: 'Semiagressivo', agressivo: 'Agressivo' }
export const DIFICULDADE = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }
const intervalo = (min, max, unidade = '') => min == null || max == null ? null : `${min}–${max}${unidade}`
const invalida = () => { throw new ErroApi('Resposta inválida do catálogo.', {}, 502) }

export function lerEnvelope(resposta) {
  if (!resposta || !Array.isArray(resposta.itens) || !Number.isSafeInteger(resposta.total) || resposta.total < resposta.itens.length) invalida()
  return resposta
}

export function lerCategoria(c) {
  if (!c || !Number.isSafeInteger(c.id) || c.id < 1 || typeof c.nome !== 'string' || typeof c.slug !== 'string') invalida()
  return { id: c.id, nome: c.nome, slug: c.slug }
}

// URLs relativas ao site e HTTP(S), sem credenciais; rejeita esquemas executáveis e URLs //host.
export function imagemSegura(valor) {
  if (typeof valor !== 'string' || /[\\\s]/.test(valor) || [...valor].some((c) => c.charCodeAt(0) < 32)) return null
  if (valor.startsWith('/') && !valor.startsWith('//')) return valor
  try {
    const url = new URL(valor)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function normalizarProduto(p, categorias) {
  if (!p || !Number.isSafeInteger(p.id) || p.id < 1 || !Number.isSafeInteger(p.preco) || p.preco < 0
    || typeof p.nome !== 'string' || typeof p.categoria !== 'string' || typeof p.emEstoque !== 'boolean') invalida()
  const categoria = categorias.find((c) => c.slug === p.categoria)?.nome ?? p.categoria
  const fichaTecnica = p.ficha ?? null
  const dados = fichaTecnica?.dados
  const peixe = fichaTecnica?.tipo === 'peixes' ? dados : null
  const foto = imagemSegura(p.imagemUrl)
  const ficha = peixe ? {
    tipoAgua: AGUA[peixe.tipoAgua], temperatura: intervalo(peixe.tempMinC, peixe.tempMaxC, ' °C'),
    ph: intervalo(peixe.phMin, peixe.phMax), temperamento: TEMPERAMENTO[peixe.temperamento],
    aquarioMinimo: peixe.aquarioMinLitros, tamanhoAdulto: `${peixe.tamanhoAdultoCm} cm`,
    dificuldade: { nivel: ['iniciante', 'intermediario', 'avancado'].indexOf(peixe.dificuldade) + 1, rotulo: DIFICULDADE[peixe.dificuldade] },
    cores: null,
  } : null
  return {
    id: p.id, categoriaId: p.categoriaId, categoriaSlug: p.categoria, categoria,
    tipo: p.categoria === 'peixes' ? 'peixe' : 'produto', nome: p.nome,
    descricao: p.descricao, marca: p.marca, preco: p.preco, centavos: true,
    cientifico: peixe?.nomeCientifico ?? null, emEstoque: p.emEstoque,
    disponibilidade: p.emEstoque ? 'disponivel' : 'esgotado', estoque: p.emEstoque ? null : 0,
    entregaLocal: p.categoria === 'peixes', imagens: foto ? [{ src: foto, alt: p.nome }] : [],
    fichaTecnica, ficha, combinaCom: [], evitarCom: [],
    volumeLitros: fichaTecnica?.tipo === 'aquarios' ? dados.volumeLitros : null,
    capacidadeMaxLitros: dados?.aquarioMaxLitros ?? null,
    chips: ficha ? [
      { id: 'temperamento', rotulo: ficha.temperamento, titulo: 'Temperamento' },
      { id: 'aquario', rotulo: `Mín. ${ficha.aquarioMinimo} L`, titulo: 'Aquário mínimo' },
      { id: 'temperatura', rotulo: ficha.temperatura, titulo: 'Temperatura da água' },
    ] : [{ id: 'categoria', rotulo: categoria, titulo: 'Categoria' }],
  }
}

// Lista fechada de campos públicos das onze fichas. Não renderiza campos inesperados do servidor.
const CAMPOS = {
  nomeCientifico: ['Nome científico'], origem: ['Origem'], tipoAgua: ['Tipo de água'],
  tamanhoAdultoCm: ['Tamanho adulto', ' cm'], tempMinC: ['Temperatura mínima', ' °C'], tempMaxC: ['Temperatura máxima', ' °C'],
  phMin: ['pH mínimo'], phMax: ['pH máximo'], aquarioMinLitros: ['Aquário mínimo', ' L'], aquarioMaxLitros: ['Aquário máximo', ' L'],
  temperamento: ['Temperamento'], nivelNatacao: ['Nível de natação'], cardumeMinimo: ['Cardume mínimo'], dieta: ['Dieta'], dificuldade: ['Dificuldade'],
  volumeLitros: ['Volume', ' L'], comprimentoCm: ['Comprimento', ' cm'], larguraCm: ['Largura', ' cm'], alturaCm: ['Altura', ' cm'], material: ['Material'],
  tipo: ['Tipo'], vazaoLh: ['Vazão', ' L/h'], potenciaW: ['Potência', ' W'], voltagem: ['Voltagem'], midiasInclusas: ['Mídias inclusas'],
  alturaMaxM: ['Altura máxima', ' m'], saidas: ['Saídas'], tecnologia: ['Tecnologia'], espectro: ['Espectro'], temperaturaCorK: ['Temperatura de cor', ' K'],
  ajustavel: ['Ajustável'], formato: ['Formato'], pesoG: ['Peso', ' g'], indicadaPara: ['Indicada para'], volumeMl: ['Volume', ' mL'],
  dosagem: ['Dosagem'], principioAtivo: ['Princípio ativo'], pesoKg: ['Peso', ' kg'], granulometriaMm: ['Granulometria (mm)'], cor: ['Cor'], alteraPh: ['Altera pH'],
  nome: ['Nome da planta'], posicao: ['Posição'], iluminacaoExigida: ['Iluminação exigida'], precisaCo2: ['Precisa de CO₂'], crescimento: ['Crescimento'],
  materialNatural: ['Material natural'], seguroMarinho: ['Seguro em água salgada'],
}
export function linhasFicha(ficha) {
  if (!ficha) return []
  return Object.entries(ficha.dados).filter(([campo]) => CAMPOS[campo]).map(([campo, valor]) => {
    const [rotulo, unidade = ''] = CAMPOS[campo]
    const texto = valor == null ? 'Não informado' : typeof valor === 'boolean' ? (valor ? 'Sim' : 'Não')
      : ({ tipoAgua: AGUA, temperamento: TEMPERAMENTO, dificuldade: DIFICULDADE }[campo]?.[valor] ?? String(valor).replaceAll('_', ' ')) + unidade
    return [rotulo, texto]
  })
}

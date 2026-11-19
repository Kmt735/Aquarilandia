export const categorias = [
  { nome: 'Aquários', icone: '🧊' },
  { nome: 'Filtros', icone: '💧' },
  { nome: 'Bombas', icone: '🌊' },
  { nome: 'Iluminação', icone: '💡' },
  { nome: 'Termostatos', icone: '🌡️' },
  { nome: 'Rações', icone: '🍽️' },
  {
    nome: 'Condicionadores',
    icone: '🧪',
    dica: 'Produtos que neutralizam o cloro da água da torneira e deixam a água segura para os peixes.',
  },
  { nome: 'Substratos', icone: '🪨' },
  { nome: 'Plantas', icone: '🌿' },
  { nome: 'Decorações', icone: '🏯' },
  { nome: 'Acessórios', icone: '🎒' },
]

// Peixes são uma categoria do catálogo, mas com página própria (filtros de ficha técnica)
export const categoriasMenu = [{ nome: 'Peixes', icone: '🐟' }, ...categorias]

// Cards da home: o rótulo pode agrupar categorias, mas o filtro aplicado é `categoria`
export const categoriasDestaque = [
  { rotulo: 'Aquários', icone: '🧊', categoria: 'Aquários' },
  { rotulo: 'Filtros & Bombas', icone: '💧', categoria: 'Filtros' },
  { rotulo: 'Iluminação', icone: '💡', categoria: 'Iluminação' },
  { rotulo: 'Plantas', icone: '🌿', categoria: 'Plantas' },
  { rotulo: 'Rações', icone: '🍽️', categoria: 'Rações' },
  { rotulo: 'Condicionadores', icone: '🧪', categoria: 'Condicionadores' },
  { rotulo: 'Substratos', icone: '🪨', categoria: 'Substratos' },
  { rotulo: 'Decorações', icone: '🏯', categoria: 'Decorações' },
]

export const disponibilidades = [
  { valor: 'in', rotulo: 'Em estoque' },
  { valor: 'out', rotulo: 'Esgotado' },
]

export const faixasPreco = [
  { valor: 'ate-50', rotulo: 'Até R$ 49,99', min: 0, max: 4999 },
  { valor: '50-200', rotulo: 'R$ 50 a R$ 199,99', min: 5000, max: 19999 },
  { valor: 'acima-200', rotulo: 'R$ 200 ou mais', min: 20000, max: Infinity },
]

// "Relevância" é a ordem padrão da API. "z-a" saiu do menu, mas links antigos com ?ordem=z-a continuam valendo.
export const ordenacoes = [
  { valor: 'padrao', rotulo: 'Relevância' },
  { valor: 'menor-preco', rotulo: 'Menor preço' },
  { valor: 'maior-preco', rotulo: 'Maior preço' },
  { valor: 'a-z', rotulo: 'Nome (A a Z)' },
]

// Tipo de água na Loja. A API só filtra as categorias que têm esse dado na ficha (backend/produto.repository).
export const tiposAgua = [
  { valor: 'doce', rotulo: 'Água doce', curto: 'Doce' },
  { valor: 'salgada', rotulo: 'Água salgada', curto: 'Salgada' },
  { valor: 'salobra', rotulo: 'Água salobra', curto: 'Salobra' },
]
export const CATEGORIAS_COM_AGUA = ['peixes', 'aquarios', 'racoes', 'condicionadores', 'decoracoes']
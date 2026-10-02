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
  { valor: 'out', rotulo: 'Sob encomenda' },
]

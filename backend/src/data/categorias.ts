import type { Categoria } from '../types/index.js'

export const categorias: Categoria[] = [
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

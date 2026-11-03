// Textos das etapas do "Monte seu Aquário" (a ordem segue lib/montagem.js › ETAPAS)
export const etapasMontagem = [
  { id: 'aquario', rotulo: 'Aquário', titulo: 'Escolha o aquário', descricao: 'O tamanho do aquário define o resto: equipamentos, quantidade de substrato e quantos peixes cabem.' },
  { id: 'equipamentos', rotulo: 'Equipamentos', titulo: 'Equipamentos', descricao: 'Filtro, aquecedor e luz. Os que servem para o seu aquário aparecem primeiro.' },
  { id: 'substrato', rotulo: 'Substrato', titulo: 'Substrato', descricao: 'O "chão" do aquário. Calculamos quanto você vai precisar.' },
  { id: 'decoracao', rotulo: 'Decoração', titulo: 'Decoração', descricao: 'Pedras, troncos e enfeites. Esta etapa é opcional.', opcional: true },
  { id: 'plantas', rotulo: 'Plantas', titulo: 'Plantas', descricao: 'Plantas vivas decoram e ajudam a manter a água boa. Esta etapa é opcional.', opcional: true },
  { id: 'peixes', rotulo: 'Peixes', titulo: 'Peixes', descricao: 'Escolha as espécies e quantos de cada. Avisamos se algo não combinar.' },
]

export const rotulosEtapas = Object.fromEntries(etapasMontagem.map((e) => [e.id, e.rotulo]))

// Grupos dentro da etapa de equipamentos (slug da categoria → título)
export const gruposEquipamentos = [
  { slug: 'filtros', titulo: 'Filtro', termo: 'filtro' },
  { slug: 'termostatos', titulo: 'Termostato/aquecedor', termo: 'termostato' },
  { slug: 'iluminacao', titulo: 'Iluminação' },
]

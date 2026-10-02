export const peixes = [
  {
    id: 'acara-disco',
    nome: 'Acará Disco',
    cientifico: 'Symphysodon spp.',
    icone: '🐠',
    agua: 'Doce · 28-30°C',
    temperamento: 'Pacífico',
    aquarioMinimo: '150L',
    dificuldade: '●●● Avançado',
    disponivel: true,
    compativelCom: 'Néon Cardinal e Corydoras',
    caracteristicas: { doce: true, salgada: false, pacifico: true, facil: false },
  },
  {
    id: 'betta-splendens',
    nome: 'Betta Splendens',
    cientifico: 'Betta splendens',
    icone: '🐟',
    agua: 'Doce · 24-27°C',
    temperamento: 'Territorial',
    aquarioMinimo: '20L',
    dificuldade: '●○○ Fácil',
    disponivel: true,
    compativelCom: 'Corydoras; evite peixes de nadadeira longa e outros bettas machos',
    caracteristicas: { doce: true, salgada: false, pacifico: false, facil: true },
  },
  {
    id: 'kinguio-ranchu',
    nome: 'Kinguio Ranchu',
    cientifico: 'Carassius auratus',
    icone: '🥇',
    agua: 'Doce · 18-22°C',
    temperamento: 'Pacífico',
    aquarioMinimo: '80L',
    dificuldade: '●○○ Fácil',
    disponivel: false,
    compativelCom: 'outros kinguios (peixes de água mais fria)',
    caracteristicas: { doce: true, salgada: false, pacifico: true, facil: true },
  },
]

export const peixesDestaque = [
  { nome: 'Kinguio Ranchu', cientifico: 'Carassius auratus', icone: '🐠', dificuldade: '●○○ Fácil' },
  { nome: 'Betta Splendens', cientifico: 'Betta splendens', icone: '🐟', dificuldade: '●○○ Fácil' },
  { nome: 'Corydora Bronze', cientifico: 'Corydoras aeneus', icone: '🐡', dificuldade: '●○○ Fácil' },
  { nome: 'Acará Disco', cientifico: 'Symphysodon spp.', icone: '🐠', dificuldade: '●●● Avançado' },
]

export const filtrosPeixe = [
  { valor: 'doce', rotulo: 'Água doce' },
  { valor: 'salgada', rotulo: 'Água salgada' },
  { valor: 'pacifico', rotulo: 'Pacífico' },
  { valor: 'facil', rotulo: 'Fácil de cuidar' },
  { valor: 'disp', rotulo: 'Disponível na loja' },
]

export const atendeFiltro = (peixe, filtro) =>
  filtro === 'disp' ? peixe.disponivel : Boolean(peixe.caracteristicas[filtro])

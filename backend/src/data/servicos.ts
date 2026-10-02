import type { Servico } from '../types/index.js'

export const servicos: Servico[] = [
  {
    id: 'montagem',
    nome: 'Montagem de aquários',
    icone: '🧰',
    resumo: 'Instalação completa no seu espaço, do zero.',
    descricao: 'Instalação completa, do posicionamento à água pronta pros primeiros peixes.',
    destaque: true,
  },
  {
    id: 'plantados',
    nome: 'Aquários plantados',
    icone: '🌱',
    resumo: 'Projetos de aquapaisagismo sob medida.',
    descricao: 'Projetos de aquapaisagismo com seleção de plantas e substrato ideais.',
    destaque: true,
  },
  {
    id: 'personalizados',
    nome: 'Projetos personalizados',
    icone: '✏️',
    descricao: 'Aquário sob medida pro seu espaço, estilo e orçamento.',
  },
  {
    id: 'manutencao',
    nome: 'Manutenção',
    icone: '🔧',
    resumo: 'Visitas periódicas de troca de água e limpeza.',
    descricao: 'Visitas periódicas de troca de água, limpeza de filtro e checagem geral.',
    destaque: true,
  },
  {
    id: 'consultoria',
    nome: 'Consultoria',
    icone: '💬',
    descricao: 'Orientação técnica pontual pra resolver um problema ou planejar um projeto.',
  },
  {
    id: 'empresas',
    nome: 'Montagem para empresas',
    icone: '🏢',
    descricao: 'Aquários corporativos para recepções, escritórios e comércios.',
  },
]

export const opcoesServico = [...servicos.map((s) => s.nome), 'Outro']

import type { FichaTecnica } from './ficha.types.js'

interface BaseCampo { coluna: string; opcional?: true }
export type CampoFicha = BaseCampo & (
  | { tipo: 'texto'; maximo?: number }
  | { tipo: 'numero'; minimo: number; maximo: number; casas: number; padrao?: number }
  | { tipo: 'booleano'; padrao: boolean }
  | { tipo: 'enum'; valores: readonly string[] }
)
type Definicoes = {
  [T in FichaTecnica['tipo']]: Record<keyof Extract<FichaTecnica, { tipo: T }>['dados'], CampoFicha>
}

const voltagens = ['110', '220', 'bivolt'] as const
const dificuldades = ['iniciante', 'intermediario', 'avancado'] as const
const tiposAgua = ['doce', 'marinho', 'ambos'] as const
const inteiro = (coluna: string, opcional?: true): CampoFicha => (
  { coluna, tipo: 'numero', minimo: 1, maximo: 2147483647, casas: 0, opcional }
)
const dimensao = (coluna: string, opcional?: true): CampoFicha => (
  { coluna, tipo: 'numero', minimo: 0.1, maximo: 99999.9, casas: 1, opcional }
)
const temperatura = (coluna: string, opcional?: true): CampoFicha => (
  { coluna, tipo: 'numero', minimo: -999.9, maximo: 999.9, casas: 1, opcional }
)

// Lista fechada de tabelas, colunas e regras derivadas de 01_catalogo.sql.
// O mapped type exige exatamente os campos públicos de cada ficha já consultável.
export const definicoesFicha = {
  peixes: {
    nomeCientifico: { coluna: 'nome_cientifico', tipo: 'texto', maximo: 120 },
    origem: { coluna: 'origem', tipo: 'texto', maximo: 120, opcional: true },
    tipoAgua: { coluna: 'tipo_agua', tipo: 'enum', valores: ['doce', 'salobra', 'marinho'] },
    tamanhoAdultoCm: { coluna: 'tamanho_adulto_cm', tipo: 'numero', minimo: 0.1, maximo: 9999.9, casas: 1 },
    tempMinC: temperatura('temp_min_c'), tempMaxC: temperatura('temp_max_c'),
    phMin: { coluna: 'ph_min', tipo: 'numero', minimo: 0, maximo: 14, casas: 1 },
    phMax: { coluna: 'ph_max', tipo: 'numero', minimo: 0, maximo: 14, casas: 1 },
    aquarioMinLitros: inteiro('aquario_min_litros'),
    temperamento: { coluna: 'temperamento', tipo: 'enum', valores: ['pacifico', 'semi_agressivo', 'agressivo'] },
    nivelNatacao: { coluna: 'nivel_natacao', tipo: 'enum', valores: ['fundo', 'meio', 'superficie', 'todos'], opcional: true },
    cardumeMinimo: { coluna: 'cardume_minimo', tipo: 'numero', minimo: 1, maximo: 2147483647, casas: 0, padrao: 1 },
    dieta: { coluna: 'dieta', tipo: 'enum', valores: ['onivoro', 'carnivoro', 'herbivoro'], opcional: true },
    dificuldade: { coluna: 'dificuldade', tipo: 'enum', valores: dificuldades },
  },
  aquarios: {
    volumeLitros: inteiro('volume_litros'), comprimentoCm: dimensao('comprimento_cm'),
    larguraCm: dimensao('largura_cm'), alturaCm: dimensao('altura_cm'),
    material: { coluna: 'material', tipo: 'enum', valores: ['vidro', 'acrilico'] },
    tipoAgua: { coluna: 'tipo_agua', tipo: 'enum', valores: tiposAgua },
  },
  filtros: {
    tipo: { coluna: 'tipo', tipo: 'enum', valores: ['hang_on', 'canister', 'interno', 'esponja', 'sump'] },
    vazaoLh: inteiro('vazao_lh'), aquarioMaxLitros: inteiro('aquario_max_litros', true),
    potenciaW: { coluna: 'potencia_w', tipo: 'numero', minimo: 0, maximo: 99999.9, casas: 1, opcional: true },
    voltagem: { coluna: 'voltagem', tipo: 'enum', valores: voltagens, opcional: true },
    midiasInclusas: { coluna: 'midias_inclusas', tipo: 'texto', opcional: true },
  },
  bombas: {
    tipo: { coluna: 'tipo', tipo: 'enum', valores: ['submersa', 'circulacao', 'ar'] },
    vazaoLh: inteiro('vazao_lh'),
    alturaMaxM: { coluna: 'altura_max_m', tipo: 'numero', minimo: 0.01, maximo: 99.99, casas: 2, opcional: true },
    saidas: inteiro('saidas', true),
    potenciaW: { coluna: 'potencia_w', tipo: 'numero', minimo: 0, maximo: 99999.9, casas: 1, opcional: true },
    voltagem: { coluna: 'voltagem', tipo: 'enum', valores: voltagens, opcional: true },
  },
  iluminacao: {
    tecnologia: { coluna: 'tecnologia', tipo: 'enum', valores: ['led', 'fluorescente'] },
    potenciaW: dimensao('potencia_w'), comprimentoCm: dimensao('comprimento_cm', true),
    espectro: { coluna: 'espectro', tipo: 'enum', valores: ['branco', 'rgb', 'plantado', 'marinho'], opcional: true },
    temperaturaCorK: inteiro('temperatura_cor_k', true),
    voltagem: { coluna: 'voltagem', tipo: 'enum', valores: voltagens, opcional: true },
  },
  termostatos: {
    potenciaW: dimensao('potencia_w'), aquarioMinLitros: inteiro('aquario_min_litros', true),
    aquarioMaxLitros: inteiro('aquario_max_litros', true),
    tempMinC: temperatura('temp_min_c', true), tempMaxC: temperatura('temp_max_c', true),
    ajustavel: { coluna: 'ajustavel', tipo: 'booleano', padrao: true },
    voltagem: { coluna: 'voltagem', tipo: 'enum', valores: voltagens, opcional: true },
  },
  racoes: {
    formato: { coluna: 'formato', tipo: 'enum', valores: ['flocos', 'granulos', 'pastilhas', 'palitos', 'liofilizada', 'congelada'] },
    pesoG: inteiro('peso_g'), tipoAgua: { coluna: 'tipo_agua', tipo: 'enum', valores: tiposAgua },
    indicadaPara: { coluna: 'indicada_para', tipo: 'texto', opcional: true },
  },
  condicionadores: {
    tipo: { coluna: 'tipo', tipo: 'enum', valores: ['condicionador', 'medicamento', 'bacterias', 'suplemento', 'teste_agua'] },
    volumeMl: inteiro('volume_ml', true), dosagem: { coluna: 'dosagem', tipo: 'texto', opcional: true },
    principioAtivo: { coluna: 'principio_ativo', tipo: 'texto', opcional: true },
    tipoAgua: { coluna: 'tipo_agua', tipo: 'enum', valores: tiposAgua },
  },
  substratos: {
    tipo: { coluna: 'tipo', tipo: 'enum', valores: ['areia', 'cascalho', 'fertil', 'argila', 'coral'] },
    pesoKg: { coluna: 'peso_kg', tipo: 'numero', minimo: 0.01, maximo: 999.99, casas: 2 },
    granulometriaMm: { coluna: 'granulometria_mm', tipo: 'texto', maximo: 20, opcional: true },
    cor: { coluna: 'cor', tipo: 'texto', maximo: 40, opcional: true },
    alteraPh: { coluna: 'altera_ph', tipo: 'booleano', padrao: false },
  },
  plantas: {
    nome: { coluna: 'nome', tipo: 'texto', maximo: 120 },
    posicao: { coluna: 'posicao', tipo: 'enum', valores: ['frente', 'meio', 'fundo', 'flutuante', 'epifita'] },
    iluminacaoExigida: { coluna: 'iluminacao_exigida', tipo: 'enum', valores: ['baixa', 'media', 'alta'] },
    precisaCo2: { coluna: 'precisa_co2', tipo: 'booleano', padrao: false },
    crescimento: { coluna: 'crescimento', tipo: 'enum', valores: ['lento', 'medio', 'rapido'], opcional: true },
    dificuldade: { coluna: 'dificuldade', tipo: 'enum', valores: dificuldades },
    tempMinC: temperatura('temp_min_c', true), tempMaxC: temperatura('temp_max_c', true),
  },
  decoracoes: {
    material: { coluna: 'material', tipo: 'enum', valores: ['resina', 'pedra', 'tronco', 'ceramica', 'plastico'] },
    materialNatural: { coluna: 'material_natural', tipo: 'booleano', padrao: false },
    comprimentoCm: dimensao('comprimento_cm', true), larguraCm: dimensao('largura_cm', true), alturaCm: dimensao('altura_cm', true),
    seguroMarinho: { coluna: 'seguro_marinho', tipo: 'booleano', padrao: false },
  },
} satisfies Definicoes

export function ehTipoFicha(tipo: string): tipo is FichaTecnica['tipo'] {
  return Object.hasOwn(definicoesFicha, tipo)
}

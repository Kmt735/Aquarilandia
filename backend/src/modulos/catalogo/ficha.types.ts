type TipoAgua = 'doce' | 'marinho' | 'ambos'
type Voltagem = '110' | '220' | 'bivolt'
type Dificuldade = 'iniciante' | 'intermediario' | 'avancado'

interface FichaPeixe {
  nomeCientifico: string
  origem: string | null
  tipoAgua: 'doce' | 'salobra' | 'marinho'
  tamanhoAdultoCm: number
  tempMinC: number
  tempMaxC: number
  phMin: number
  phMax: number
  aquarioMinLitros: number
  temperamento: 'pacifico' | 'semi_agressivo' | 'agressivo'
  nivelNatacao: 'fundo' | 'meio' | 'superficie' | 'todos' | null
  cardumeMinimo: number
  dieta: 'onivoro' | 'carnivoro' | 'herbivoro' | null
  dificuldade: Dificuldade
}

interface FichaAquario {
  volumeLitros: number
  comprimentoCm: number
  larguraCm: number
  alturaCm: number
  material: 'vidro' | 'acrilico'
  tipoAgua: TipoAgua
}

interface FichaFiltro {
  tipo: 'hang_on' | 'canister' | 'interno' | 'esponja' | 'sump'
  vazaoLh: number
  aquarioMaxLitros: number | null
  potenciaW: number | null
  voltagem: Voltagem | null
  midiasInclusas: string | null
}

interface FichaBomba {
  tipo: 'submersa' | 'circulacao' | 'ar'
  vazaoLh: number
  alturaMaxM: number | null
  saidas: number | null
  potenciaW: number | null
  voltagem: Voltagem | null
}

interface FichaIluminacao {
  tecnologia: 'led' | 'fluorescente'
  potenciaW: number
  comprimentoCm: number | null
  espectro: 'branco' | 'rgb' | 'plantado' | 'marinho' | null
  temperaturaCorK: number | null
  voltagem: Voltagem | null
}

interface FichaTermostato {
  potenciaW: number
  aquarioMinLitros: number | null
  aquarioMaxLitros: number | null
  tempMinC: number | null
  tempMaxC: number | null
  ajustavel: boolean
  voltagem: Voltagem | null
}

interface FichaRacao {
  formato: 'flocos' | 'granulos' | 'pastilhas' | 'palitos' | 'liofilizada' | 'congelada'
  pesoG: number
  tipoAgua: TipoAgua
  indicadaPara: string | null
}

interface FichaCondicionador {
  tipo: 'condicionador' | 'medicamento' | 'bacterias' | 'suplemento' | 'teste_agua'
  volumeMl: number | null
  dosagem: string | null
  principioAtivo: string | null
  tipoAgua: TipoAgua
}

interface FichaSubstrato {
  tipo: 'areia' | 'cascalho' | 'fertil' | 'argila' | 'coral'
  pesoKg: number
  granulometriaMm: string | null
  cor: string | null
  alteraPh: boolean
}

interface FichaPlanta {
  nome: string
  posicao: 'frente' | 'meio' | 'fundo' | 'flutuante' | 'epifita'
  iluminacaoExigida: 'baixa' | 'media' | 'alta'
  precisaCo2: boolean
  crescimento: 'lento' | 'medio' | 'rapido' | null
  dificuldade: Dificuldade
  tempMinC: number | null
  tempMaxC: number | null
}

interface FichaDecoracao {
  material: 'resina' | 'pedra' | 'tronco' | 'ceramica' | 'plastico'
  materialNatural: boolean
  comprimentoCm: number | null
  larguraCm: number | null
  alturaCm: number | null
  seguroMarinho: boolean
}

export type FichaTecnica =
  | { tipo: 'peixes'; dados: FichaPeixe }
  | { tipo: 'aquarios'; dados: FichaAquario }
  | { tipo: 'filtros'; dados: FichaFiltro }
  | { tipo: 'bombas'; dados: FichaBomba }
  | { tipo: 'iluminacao'; dados: FichaIluminacao }
  | { tipo: 'termostatos'; dados: FichaTermostato }
  | { tipo: 'racoes'; dados: FichaRacao }
  | { tipo: 'condicionadores'; dados: FichaCondicionador }
  | { tipo: 'substratos'; dados: FichaSubstrato }
  | { tipo: 'plantas'; dados: FichaPlanta }
  | { tipo: 'decoracoes'; dados: FichaDecoracao }

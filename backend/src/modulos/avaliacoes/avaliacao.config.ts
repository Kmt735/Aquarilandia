import { env } from '../../config/env.js'
import type { StatusAvaliacao } from './avaliacao.types.js'

// Moderação das avaliações: este é o ÚNICO lugar que decide com que status uma avaliação nova nasce.
// 'pendente' (padrão): só aparece no site depois que a loja aprovar no painel.
// 'aprovada': publica na hora. Para isso, defina AVALIACOES_PUBLICAR_DIRETO=true no ambiente (sem mexer no código).
export const STATUS_INICIAL: StatusAvaliacao = env.avaliacoesPublicarDireto ? 'aprovada' : 'pendente'

// Limites (os mesmos do frontend e das colunas de 36_avaliacoes.sql)
export const LIMITE_NOME = 40
export const LIMITE_COMENTARIO_PRODUTO = 500
export const LIMITE_COMENTARIO_SITE = 300
export const LIMITE_PAGINA = 200
// Lista pública de um produto: as N mais recentes (o resumo conta todas)
export const LIMITE_LISTA_PUBLICA = 100
// Página pública do site: os N comentários aprovados mais recentes
export const LIMITE_COMENTARIOS_SITE = 50

// Opções do formulário do site (frontend/src/data/avaliacao-site.js) e os CHECK da tabela
export const MOTIVOS = ['comprar', 'conhecer-peixes', 'aprender-aquario', 'orcamento', 'outro'] as const
export const ENCONTROU = ['sim', 'mais-ou-menos', 'nao'] as const
export const ORIGENS = ['aba', 'rodape', 'pos-compra'] as const
export const STATUS = ['pendente', 'aprovada', 'oculta'] as const

import { Router } from 'express'
import { db } from '../../config/db.js'
import { AppError } from '../../utils/AppError.js'
import { comTransacao, type Queryable } from '../../utils/transacao.js'
import { lerIdCatalogo } from './catalogo.parametros.js'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'

export interface LogisticaProduto {
  produtoId: number; pesoG: number; comprimentoCm: number; larguraCm: number; alturaCm: number
  prazoPreparacaoDias: number; envioConvencional: boolean
}
const colunas = `produto_id AS "produtoId", peso_g AS "pesoG", comprimento_cm AS "comprimentoCm",
 largura_cm AS "larguraCm", altura_cm AS "alturaCm", prazo_preparacao_dias AS "prazoPreparacaoDias",
 envio_convencional AS "envioConvencional"`
export async function buscarLogistica(ids: number[], executor: Queryable = db): Promise<Map<number, LogisticaProduto>> {
  const { rows } = await executor.query<LogisticaProduto>(`SELECT ${colunas} FROM produto_logistica WHERE produto_id=ANY($1::integer[])`, [ids])
  return new Map(rows.map((r) => [r.produtoId, r]))
}
export const logisticaRoutes = Router()
logisticaRoutes.use('/:id/logistica', autenticar, exigirAdmin)
logisticaRoutes.get('/:id/logistica', async (req, res) => {
  const id = lerIdCatalogo(typeof req.params.id === 'string' ? req.params.id : '')
  if (!(await db.query('SELECT id FROM produtos WHERE id=$1', [id])).rowCount) throw new AppError('Produto não encontrado', 404)
  res.json({ logistica: (await buscarLogistica([id])).get(id) ?? null })
})
logisticaRoutes.put('/:id/logistica', exigirOrigem, async (req, res) => {
  const id = lerIdCatalogo(typeof req.params.id === 'string' ? req.params.id : ''), dados = req.body
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new AppError('Dados inválidos', 422)
  const limites: Record<string, [number, number]> = { pesoG: [1, 1000000], comprimentoCm: [1, 300], larguraCm: [1, 300], alturaCm: [1, 300], prazoPreparacaoDias: [0, 60] }
  const erros: Record<string, string> = {}
  for (const [campo, [min, max]] of Object.entries(limites)) {
    if (!Number.isSafeInteger(dados[campo]) || dados[campo] < min || dados[campo] > max) erros[campo] = `Informe um inteiro de ${min} a ${max}.`
  }
  if (typeof dados.envioConvencional !== 'boolean') erros.envioConvencional = 'Informe true ou false.'
  for (const campo of Object.keys(dados)) if (!Object.hasOwn(limites, campo) && campo !== 'envioConvencional') erros[campo] = 'Campo não permitido.'
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  await comTransacao(async (client) => {
    // Mesma trava dos produtos na criação da venda: embalagem não muda no meio da cotação final.
    if (!(await client.query('SELECT id FROM produtos WHERE id=$1 AND ativo FOR UPDATE', [id])).rowCount) throw new AppError('Produto não encontrado', 404)
    await client.query(`INSERT INTO produto_logistica (produto_id,peso_g,comprimento_cm,largura_cm,altura_cm,prazo_preparacao_dias,envio_convencional)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(produto_id) DO UPDATE SET peso_g=$2,comprimento_cm=$3,
      largura_cm=$4,altura_cm=$5,prazo_preparacao_dias=$6,envio_convencional=$7,atualizado_em=now()`,
    [id,dados.pesoG,dados.comprimentoCm,dados.larguraCm,dados.alturaCm,dados.prazoPreparacaoDias,dados.envioConvencional])
  })
  res.json({ logistica: (await buscarLogistica([id])).get(id) })
})

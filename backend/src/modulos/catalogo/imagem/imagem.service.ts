import { randomUUID } from 'node:crypto'
import { AppError } from '../../../utils/AppError.js'
import { comTransacao } from '../../../utils/transacao.js'
import { produtoRepository } from '../produto.repository.js'
import { armazenamentoImagem } from './imagem.armazenamento.js'
import { imagemRepository as repo } from './imagem.repository.js'
import { limitesImagem } from './imagem.limites.js'

const avisarLimpeza = () => console.error('[imagem] limpeza pendente; executar imagens:limpar')
function relancar(err: unknown): never {
  if (typeof err === 'object' && err !== null && 'code' in err && ['55P03', '57014'].includes(String(err.code))) {
    throw new AppError('Produto ocupado. Tente novamente em instantes.', 503)
  }
  throw err
}
async function limparSeLivre(id: string): Promise<boolean> {
  return comTransacao(async (tx) => {
    if (!await repo.travarArquivo(id, tx, true) || await repo.referenciado(id, tx)) return false
    await armazenamentoImagem.remover(id); return true
  })
}
async function tentarLimpeza(id: string | null): Promise<void> {
  if (!id) return
  try { await limparSeLivre(id) } catch { avisarLimpeza() }
}
export const imagemService = {
  async gravar(produtoId: number, dados: Buffer) {
    const novo = randomUUID(); let antigo: string | null = null
    let resultado
    try {
      resultado = await comTransacao(async (tx) => {
        await tx.query("SET LOCAL lock_timeout='3s'")
        await tx.query("SET LOCAL statement_timeout='5s'")
        const produto = await repo.bloquear(produtoId, tx)
        if (!produto) throw new AppError('Produto não encontrado', 404)
        antigo = produto.imagemId
        await repo.travarArquivo(novo, tx)
        // Arquivo durável antes de publicar a referência. Locks impedem que a limpeza remova arquivo em processamento.
        try { await armazenamentoImagem.gravar(novo, dados) }
        catch { throw new AppError('Não foi possível armazenar a imagem.', 503) }
        await repo.vincular(produtoId, novo, tx)
        const dto = await produtoRepository.buscarAdministrativo(produtoId, tx)
        if (!dto) throw new Error('Produto não encontrado na transação de imagem.')
        return dto
      })
    } catch (e) {
      // COMMIT pode ter sido confirmado sem resposta. Nunca apagar sem reconsultar referências sob advisory lock.
      await tentarLimpeza(novo)
      relancar(e)
    }
    await tentarLimpeza(antigo)
    return resultado
  },
  async remover(produtoId: number) {
    let antigo: string | null = null
    const resultado = await comTransacao(async (tx) => {
      await tx.query("SET LOCAL lock_timeout='3s'")
      await tx.query("SET LOCAL statement_timeout='5s'")
      const produto = await repo.bloquear(produtoId, tx)
      if (!produto) throw new AppError('Produto não encontrado', 404)
      antigo = produto.imagemId
      if (produto.imagemUrl !== null || antigo !== null) await repo.vincular(produtoId, null, tx)
      const dto = await produtoRepository.buscarAdministrativo(produtoId, tx)
      if (!dto) throw new Error('Produto não encontrado na transação de imagem.')
      return dto
    }).catch(relancar)
    // Referência legada sem ID gerenciado não vira um caminho a apagar.
    await tentarLimpeza(antigo); return resultado
  },
  async limparOrfaos() {
    const ids = await armazenamentoImagem.candidatos(Date.now() - limitesImagem.idadeOrfaoMs)
    let removidos = 0, preservados = 0, erros = 0
    for (const id of ids) {
      try { if (await limparSeLivre(id)) removidos++; else preservados++ }
      catch { erros++; avisarLimpeza() }
    }
    return { removidos, preservados, erros }
  },
}

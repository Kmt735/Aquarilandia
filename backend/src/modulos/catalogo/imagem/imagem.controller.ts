import { Router } from 'express'
import type { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { AppError } from '../../../utils/AppError.js'
import { env } from '../../../config/env.js'
import { lerIdCatalogo } from '../catalogo.parametros.js'
import { receberImagem } from './imagem.upload.js'
import { processarImagem } from './imagem.processamento.js'
import { imagemService } from './imagem.service.js'
import { imagemRepository } from './imagem.repository.js'
import { armazenamentoImagem } from './imagem.armazenamento.js'
import { padraoImagemId, limitesImagem } from './imagem.limites.js'

export const limiteUploadImagem = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req, _res, next) => next(new AppError('Muitos uploads. Tente novamente em instantes.', 429)),
})
let processando = 0
export const imagemController = {
  async gravar(req: Request, res: Response): Promise<void> {
    if (processando >= limitesImagem.simultaneas) throw new AppError('Processamento de imagens ocupado. Tente novamente.', 503)
    processando++
    try {
      if (Object.keys(req.query).length) throw new AppError('Não envie parâmetros na administração da imagem.', 400)
      const id = lerIdCatalogo(String(req.params.id))
      if (!await imagemRepository.existe(id)) throw new AppError('Produto não encontrado', 404)
      if (!env.imagensDir) throw new AppError('Armazenamento de imagens não configurado.', 503)
      const arquivo = await receberImagem(req, res)
      const dados = await processarImagem(arquivo)
      res.status(200).json(await imagemService.gravar(id, dados))
    } finally { processando-- }
  },
  async remover(req: Request, res: Response): Promise<void> {
    if (Object.keys(req.query).length) throw new AppError('Não envie parâmetros na administração da imagem.', 400)
    if (req.body !== undefined || Number(req.get('content-length') ?? '0') > 0 || req.get('transfer-encoding')) {
      throw new AppError('Não envie corpo na remoção da imagem.', 400)
    }
    res.status(200).json(await imagemService.remover(lerIdCatalogo(String(req.params.id))))
  },
}
export const imagemPublicaRoutes = Router()
imagemPublicaRoutes.get('/:arquivo', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const nome = req.params.arquivo, id = nome.endsWith('.webp') ? nome.slice(0, -5) : ''
  if (!padraoImagemId.test(id) || !await imagemRepository.publica(id)) throw new AppError('Imagem não encontrada.', 404)
  const arquivo = await armazenamentoImagem.abrir(id)
  let st
  try { st = await arquivo.stat() } catch { await arquivo.close(); throw new AppError('Imagem não encontrada.', 404) }
  res.set({ 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': String(st.size) })
  if (req.method === 'HEAD') { await arquivo.close(); res.end(); return }
  const stream = arquivo.createReadStream()
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
})

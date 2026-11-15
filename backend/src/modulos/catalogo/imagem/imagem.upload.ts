import multer from 'multer'
import type { Request, Response } from 'express'
import { AppError } from '../../../utils/AppError.js'
import { limitesImagem as l } from './imagem.limites.js'

const parser = multer({
  storage: multer.memoryStorage(), preservePath: true,
  limits: { fileSize: l.bytes + 1, files: 1, fields: 0, parts: 1, fieldNameSize: 20, fieldSize: 0, headerPairs: 20 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.length > 180 || /[\\/\x00-\x1f\x7f]/.test(file.originalname) || file.originalname.includes('..')) {
      cb(new AppError('Nome de arquivo inválido.', 400)); return
    }
    cb(null, true)
  },
}).single('imagem')

export function receberImagem(req: Request, res: Response): Promise<Express.Multer.File> {
  const recusar = (mensagem: string, status: number): never => {
    res.set('Connection', 'close'); res.once('finish', () => req.destroy()); throw new AppError(mensagem, status)
  }
  if (!req.is('multipart/form-data')) recusar('Envie multipart/form-data com o arquivo imagem.', 415)
  if (req.get('content-encoding') && req.get('content-encoding') !== 'identity') recusar('Envie o arquivo sem compressão HTTP.', 415)
  const comprimento = req.get('content-length')
  if (comprimento && Number(comprimento) > l.requisicaoBytes) recusar('Upload excede o limite permitido.', 413)
  return new Promise((resolve, reject) => {
    let terminou = false, bytes = 0
    const concluir = (err?: unknown) => {
      if (terminou) return
      terminou = true; clearTimeout(timer); req.off('aborted', abortar); req.off('data', contar)
      if (err) {
        // Não manter uma conexão recebendo corpo indefinidamente após rejeitar seu multipart.
        res.set('Connection', 'close'); res.once('finish', () => req.destroy())
        if (err instanceof AppError) reject(err)
        else if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') reject(new AppError('Imagem excede o limite de 5 MiB.', 413))
        else reject(new AppError('Multipart inválido: envie somente um arquivo no campo imagem, sem campos extras.', 400))
      } else if (!req.file) reject(new AppError('Envie um arquivo no campo imagem.', 400))
      else resolve(req.file)
    }
    const interromper = (err: AppError) => { req.unpipe(); req.resume(); concluir(err) }
    const abortar = () => interromper(new AppError('Upload interrompido.', 400))
    const contar = (chunk: Buffer) => { bytes += chunk.length; if (bytes > l.requisicaoBytes) interromper(new AppError('Upload excede o limite permitido.', 413)) }
    const timer = setTimeout(() => interromper(new AppError('Tempo de upload excedido.', 408)), l.recebimentoMs)
    timer.unref(); req.on('aborted', abortar); req.on('data', contar)
    parser(req, res, concluir)
  })
}

import { AppError } from '../../../utils/AppError.js'
import { limitesImagem as l } from './imagem.limites.js'

const mimePorFormato = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const
const invalida = () => new AppError('Envie uma imagem JPEG, PNG ou WebP estática e válida.', 400)
let preparado = false
// Não depender do suporte do decoder a APNG: o chunk acTL anuncia animação, mesmo se só o primeiro frame for lido.
function temAnimacao(buf: Buffer, formato: string): boolean {
  if (formato === 'png') {
    for (let i = 8; i + 12 <= buf.length;) {
      const tamanho = buf.readUInt32BE(i), tipo = buf.toString('ascii', i + 4, i + 8)
      if (tipo === 'acTL') return true
      i += tamanho + 12
    }
  }
  if (formato === 'webp') {
    for (let i = 12; i + 8 <= buf.length;) {
      const tipo = buf.toString('ascii', i, i + 4), tamanho = buf.readUInt32LE(i + 4)
      if (tipo === 'ANIM' || tipo === 'ANMF' || (tipo === 'VP8X' && i + 8 < buf.length && (buf[i + 8] & 2) !== 0)) return true
      i += 8 + tamanho + (tamanho % 2)
    }
  }
  return false
}

export async function processarImagem(arquivo: Express.Multer.File): Promise<Buffer> {
  if (!arquivo.buffer.length) throw invalida()
  if (arquivo.buffer.length > l.bytes) throw new AppError('Imagem excede o limite de 5 MiB.', 413)
  try {
    const b = arquivo.buffer
    const assinatura = b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
      : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'jpeg'
        : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
    if (!assinatura || temAnimacao(b, assinatura)) throw invalida()
    const { default: sharp } = await import('sharp')
    if (!preparado) { sharp.cache({ memory: 16, files: 0, items: 16 }); sharp.concurrency(1); preparado = true }
    const opcoes = { limitInputPixels: l.pixels, failOn: 'warning' as const }
    const meta = await sharp(arquivo.buffer, opcoes).timeout({ seconds: l.processamentoSegundos }).metadata()
    if (meta.format !== assinatura || !Object.hasOwn(mimePorFormato, meta.format)) throw invalida()
    const formato = meta.format as keyof typeof mimePorFormato
    const extensoes = { jpeg: /\.jpe?g$/i, png: /\.png$/i, webp: /\.webp$/i }
    if (arquivo.mimetype !== mimePorFormato[formato] || !extensoes[formato].test(arquivo.originalname)) throw invalida()
    if ((meta.pages ?? 1) !== 1 || temAnimacao(arquivo.buffer, formato)) throw invalida()
    if (!meta.width || !meta.height || meta.width > l.dimensao || meta.height > l.dimensao || meta.width * meta.height > l.pixels) {
      throw new AppError('Imagem excede 4096 pixels por dimensão ou 12 milhões de pixels.', 400)
    }
    // Sem withMetadata/keepMetadata: não preservar EXIF/GPS/ICC/comentários. Decodifica todos os pixels e reencoda.
    const saida = await sharp(arquivo.buffer, opcoes).timeout({ seconds: l.processamentoSegundos })
      .rotate().toColourspace('srgb').webp({ quality: 82, effort: 4 }).toBuffer()
    if (saida.length > l.bytes) throw new AppError('Imagem processada excede o limite de 5 MiB.', 413)
    return saida
  } catch (err) {
    if (err instanceof AppError) throw err
    // Mensagens livres do decoder nunca são logadas ou retornadas.
    throw invalida()
  }
}

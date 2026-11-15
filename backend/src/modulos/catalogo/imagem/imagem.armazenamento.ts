import { constants } from 'node:fs'
import { mkdir, realpath, open, unlink, readdir, lstat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { FileHandle } from 'node:fs/promises'
import { env } from '../../../config/env.js'
import { AppError } from '../../../utils/AppError.js'
import { padraoImagemId } from './imagem.limites.js'

export interface ArmazenamentoImagem {
  gravar(id: string, dados: Buffer): Promise<void>
  abrir(id: string): Promise<FileHandle>
  remover(id: string): Promise<void>
  candidatos(antesDe: number): Promise<string[]>
}
function validarId(id: string): void { if (!padraoImagemId.test(id)) throw new AppError('Imagem não encontrada.', 404) }
const naoExiste = (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT'

// Os nomes nunca vêm de URL/filename do cliente. Não usar esta interface para assets ou referências legadas.
export const armazenamentoImagem: ArmazenamentoImagem = {
  async gravar(id, dados) {
    validarId(id); const pasta = await diretorio(), tmp = join(pasta, 'temporarios', `${id}.part`)
    const arquivo = await open(tmp, 'wx', 0o600)
    try { await arquivo.writeFile(dados); await arquivo.sync() } finally { await arquivo.close() }
    // UUID novo por versão; destino reservado por advisory lock. link com exclusividade evita sobrescrita até em colisão.
    const { link } = await import('node:fs/promises')
    await link(tmp, join(pasta, `${id}.webp`)); await unlink(tmp)
    const dir = await open(pasta, 'r'); try { await dir.sync() } finally { await dir.close() }
  },
  async abrir(id) {
    validarId(id); const pasta = await diretorio()
    let arquivo: FileHandle | undefined
    try {
      arquivo = await open(join(pasta, `${id}.webp`), constants.O_RDONLY | constants.O_NOFOLLOW)
      if (!(await arquivo.stat()).isFile()) throw new Error('arquivo inválido')
      return arquivo
    } catch { await arquivo?.close().catch(() => undefined); throw new AppError('Imagem não encontrada.', 404) }
  },
  async remover(id) {
    validarId(id); const pasta = await diretorio()
    for (const p of [join(pasta, `${id}.webp`), join(pasta, 'temporarios', `${id}.part`)]) {
      try { const st = await lstat(p); if (st.isFile() && !st.isSymbolicLink()) await unlink(p) }
      catch (e) { if (!naoExiste(e)) throw e }
    }
  },
  async candidatos(antesDe) {
    const pasta = await diretorio(), ids = new Set<string>()
    // Apenas nomes estritos gerados por este módulo, arquivos regulares e idade mínima. Sem varredura recursiva.
    for (const [dir, extensao] of [[pasta, '.webp'], [join(pasta, 'temporarios'), '.part']]) {
      for (const nome of await readdir(dir)) {
        if (!nome.endsWith(extensao)) continue
        const id = nome.slice(0, -extensao.length)
        if (!padraoImagemId.test(id)) continue
        try { const st = await lstat(join(dir, nome)); if (st.isFile() && !st.isSymbolicLink() && st.mtimeMs < antesDe) ids.add(id) }
        catch (e) { if (!naoExiste(e)) throw e }
      }
    }
    return [...ids].sort()
  },
}

async function diretorio(): Promise<string> {
  if (!env.imagensDir) throw new AppError('Armazenamento de imagens não configurado.', 503)
  const pasta = resolve(env.imagensDir)
  await mkdir(pasta, { recursive: true, mode: 0o700 })
  if (await realpath(pasta) !== pasta) throw new AppError('Armazenamento de imagens indisponível.', 503)
  const tmp = join(pasta, 'temporarios'); await mkdir(tmp, { mode: 0o700, recursive: true })
  if (await realpath(tmp) !== tmp) throw new AppError('Armazenamento de imagens indisponível.', 503)
  return pasta
}

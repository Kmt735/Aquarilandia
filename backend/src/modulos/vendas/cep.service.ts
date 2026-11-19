import { AppError } from '../../utils/AppError.js'

export interface DestinoCep { cep: string; cidade: string; uf: string; municipioIbge: string }
const cache = new Map<string, { destino: DestinoCep; vence: number }>()
const emCurso = new Map<string, Promise<DestinoCep>>()
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// URL fixa + CEP estrito: o cliente não escolhe host/caminho. Só CEP é enviado ao provedor, sem dados pessoais.
async function consultar(cep: string): Promise<DestinoCep> {
  if (!/^\d{8}$/.test(cep)) throw new AppError('CEP inválido.', 422, { cep: 'Informe um CEP com 8 números.' })
  const anterior = cache.get(cep)
  if (anterior && anterior.vence > Date.now()) return anterior.destino
  const pendente = emCurso.get(cep)
  if (pendente) return pendente
  if (emCurso.size >= 32) throw new AppError('Consulta de CEP ocupada. Tente novamente.', 503)
  const tarefa = (async () => {
    let dados: Record<string, unknown>
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000) })
      if (!resposta.ok) throw new Error('CEP indisponível')
      dados = await resposta.json()
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('CEP inválido')
    } catch { throw new AppError('Não foi possível validar o CEP agora. Tente novamente.', 503) }
    if (dados.erro === true || dados.erro === 'true') throw new AppError('CEP não encontrado.', 422, { cep: 'Confira o CEP informado.' })
    if (typeof dados.cep !== 'string' || dados.cep.replace(/\D/g, '') !== cep
      || typeof dados.localidade !== 'string' || !dados.localidade.trim()
      || typeof dados.uf !== 'string' || !/^[A-Z]{2}$/.test(dados.uf)
      || typeof dados.ibge !== 'string' || !/^\d{7}$/.test(dados.ibge)) {
      throw new AppError('Não foi possível validar o CEP agora. Tente novamente.', 503)
    }
    const destino = { cep, cidade: dados.localidade.trim(), uf: dados.uf, municipioIbge: dados.ibge }
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!)
    cache.set(cep, { destino, vence: Date.now() + 24 * 60 * 60 * 1000 })
    return destino
  })()
  emCurso.set(cep, tarefa)
  try { return await tarefa } finally { emCurso.delete(cep) }
}

export const cepService = { consultar }

export function conferirEndereco(destino: DestinoCep, endereco: { cep: string; cidade: string; uf: string }): void {
  if (destino.cep !== endereco.cep || normalizar(destino.cidade) !== normalizar(endereco.cidade) || destino.uf !== endereco.uf) {
    throw new AppError('Dados inválidos', 422, { enderecoId: 'O CEP, a cidade e o estado do endereço não correspondem. Corrija seu endereço.' })
  }
}

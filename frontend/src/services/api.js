import { ErroApi } from './http.js'

export async function requisitarApi(caminho, { metodo = 'GET', corpo, headers = {}, signal } = {}) {
  let resposta
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo, credentials: 'include', cache: 'no-store',
      headers: { Accept: 'application/json', ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: signal ?? AbortSignal.timeout(20_000),
    })
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro
    throw new ErroApi('Não foi possível conectar ao servidor. Tente novamente.', {}, 0)
  }
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    if (resposta.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('aquarilandia:sessao-expirada'))
    throw new ErroApi(dados?.erro ?? 'Não foi possível concluir a operação.', dados?.detalhes ?? {}, resposta.status)
  }
  if (dados === null) throw new ErroApi('O servidor enviou uma resposta inválida.', {}, 502)
  return dados
}

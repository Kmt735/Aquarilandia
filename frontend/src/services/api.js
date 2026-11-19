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
    if (signal?.aborted) throw erro
    throw new ErroApi('Não foi possível conectar ao servidor. Tente novamente.', {}, 0)
  }
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    if (typeof window !== 'undefined') {
      if (resposta.status === 401 && !['/auth/login', '/auth/sessao'].includes(caminho)) window.dispatchEvent(new Event('aquarilandia:sessao-expirada'))
      if (resposta.status === 403) window.dispatchEvent(new Event('aquarilandia:revalidar-sessao'))
    }
    const mensagem = resposta.status >= 500 ? 'Não foi possível concluir a operação. Tente novamente.'
      : resposta.status === 401 ? 'Sua sessão não foi reconhecida ou expirou. Entre novamente.'
        : resposta.status === 403 ? 'Operação não permitida. Confira sua permissão e a origem da página.'
          : dados?.erro ?? 'Não foi possível concluir a operação.'
    throw new ErroApi(mensagem, resposta.status >= 500 ? {} : dados?.detalhes ?? {}, resposta.status)
  }
  if (dados === null) throw new ErroApi('O servidor enviou uma resposta inválida.', {}, 502)
  return dados
}

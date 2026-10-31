import { ErroApi } from './http.js'

// Consultas públicas não dependem da sessão usada pelos outros módulos.
export async function consultarApi(caminho, parametros = {}, { signal } = {}) {
  const query = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(chave, String(valor))
  }
  let resposta
  try {
    resposta = await fetch(`/api${caminho}${query.size ? `?${query}` : ''}`, {
      headers: { Accept: 'application/json' }, credentials: 'omit', signal,
    })
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro
    throw new ErroApi('Não foi possível conectar ao catálogo.', {}, 0)
  }
  if (!resposta.ok) {
    // Não repassa mensagens técnicas de proxies ou de servidores à interface.
    const mensagem = resposta.status === 404 ? 'Item não encontrado.'
      : resposta.status === 400 ? 'Confira os filtros ou o endereço informado.'
        : 'Não foi possível consultar o catálogo.'
    throw new ErroApi(mensagem, {}, resposta.status)
  }
  try { return await resposta.json() } catch {
    throw new ErroApi('Resposta inválida do catálogo.', {}, 502)
  }
}

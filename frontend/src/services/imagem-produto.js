import { ErroApi } from './http.js'

export async function atualizarImagemProduto(produtoId, arquivo) {
  const corpo = arquivo ? new FormData() : undefined
  if (arquivo) corpo.append('imagem', arquivo)
  let resposta
  try {
    resposta = await fetch(`/api/produtos/${encodeURIComponent(produtoId)}/imagem`, {
      method: arquivo ? 'PUT' : 'DELETE', credentials: 'include', body: corpo,
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new ErroApi('Não foi possível conectar ao servidor. Tente novamente.', {}, 0)
  }
  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok || !dados) throw new ErroApi(
    resposta.status >= 500 ? 'Não foi possível atualizar a foto. Tente novamente.' : dados?.erro ?? 'Não foi possível atualizar a foto.',
    {}, resposta.ok ? 502 : resposta.status,
  )
  return dados
}

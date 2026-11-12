// INTEGRAÇÃO ADMIN: rotas do Ciclo 2 (docs/ciclo-2-2026-10-31.md).
//   GET  /api/produtos?incluir_inativos=true[&ativo=true|false]
//   POST /api/produtos/:id/reativar
// Exigem sessão válida de administrador (cookie `sid`). Sem ela o servidor responde 401 ou 403.
import { ErroApi } from './http.js'
import { lerEnvelope } from './catalogo-mapeamento.js'

async function chamar(caminho, { metodo = 'GET', parametros = {} } = {}) {
  const query = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(chave, String(valor))
  }
  let resposta
  try {
    resposta = await fetch(`/api${caminho}${query.size ? `?${query}` : ''}`, {
      method: metodo,
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
  } catch {
    throw new ErroApi('Não foi possível conectar ao servidor.', {}, 0)
  }
  if (resposta.status === 401) {
    throw new ErroApi('O servidor não reconheceu sua sessão de administrador. Entre de novo.', {}, 401)
  }
  if (resposta.status === 403) {
    throw new ErroApi('Esta conta não tem permissão de administrador no servidor.', {}, 403)
  }
  if (!resposta.ok) throw new ErroApi('Não foi possível concluir a operação.', {}, resposta.status)
  return resposta.json()
}

// situacao: 'todos' | 'ativos' | 'inativos'
export async function listarProdutosAdmin({ situacao = 'todos', pagina = 1, limite = 20 } = {}) {
  const ativo = situacao === 'ativos' ? 'true' : situacao === 'inativos' ? 'false' : undefined
  const resposta = lerEnvelope(
    await chamar('/produtos', { parametros: { incluir_inativos: 'true', ativo, pagina, limite } }),
  )
  return {
    itens: resposta.itens,
    total: resposta.total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(resposta.total / limite)),
  }
}

export const reativarProduto = (id) => chamar(`/produtos/${id}/reativar`, { metodo: 'POST' })
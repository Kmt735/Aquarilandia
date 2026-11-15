// INTEGRAÇÃO ADMIN — rotas do catálogo (docs/ciclo-2-2026-10-31.md e backend/api.md):
//   GET    /api/produtos?incluir_inativos=true[&ativo=true|false]   lista (na loja e fora da loja)
//   GET    /api/produtos/:id?incluir_inativos=true                  detalhe, com ficha
//   POST   /api/produtos                                            cadastra
//   PATCH  /api/produtos/:id                                        edita (só item que está na loja)
//   DELETE /api/produtos/:id                                        tira da loja (204)
//   POST   /api/produtos/:id/reativar                               coloca de volta na loja
// Todas exigem sessão de administrador (cookie `sid`); sem ela o servidor responde 401 ou 403.
// Peixes são produtos da categoria "peixes", com ficha técnica.
// Com VITE_CATALOGO_MOCK=true, tudo roda sobre os dados de demonstração, só em memória.
import { CATALOGO_MOCK } from '../config/ambiente.js'
import { lerEnvelope } from './catalogo-mapeamento.js'
import { ErroApi } from './http.js'

const mock = CATALOGO_MOCK ? import('../mocks/catalogo-api.js').then((m) => m.adminMock) : null

async function chamar(caminho, { metodo = 'GET', parametros = {}, corpo } = {}) {
  const query = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(chave, String(valor))
  }
  let resposta
  try {
    resposta = await fetch(`/api${caminho}${query.size ? `?${query}` : ''}`, {
      method: metodo,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(corpo !== undefined && { 'Content-Type': 'application/json' }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi('Não foi possível conectar ao servidor.', {}, 0)
  }
  if (resposta.status === 204) return null
  const json = await resposta.json().catch(() => null)
  if (resposta.ok) return json
  if (resposta.status === 401) throw new ErroApi('O servidor não reconheceu sua sessão de administrador. Entre de novo.', {}, 401)
  if (resposta.status === 403) throw new ErroApi('O servidor recusou a operação. Confira se esta conta é de administrador.', {}, 403)
  if (resposta.status === 404) throw new ErroApi('Item não encontrado. Ele pode estar fora da loja ou ter sido removido.', {}, 404)
  throw new ErroApi(json?.erro ?? 'Não foi possível concluir a operação.', json?.detalhes ?? {}, resposta.status)
}

// situacao: 'todos' | 'ativos' | 'inativos'
export async function listarCatalogoAdmin({ situacao = 'todos', categoria, busca, pagina = 1, limite = 20 } = {}) {
  const ativo = situacao === 'ativos' ? 'true' : situacao === 'inativos' ? 'false' : undefined
  const parametros = { ativo, categoria, busca: busca?.trim(), pagina, limite }
  const bruto = CATALOGO_MOCK
    ? await (await mock).listar(parametros)
    : await chamar('/produtos', { parametros: { ...parametros, incluir_inativos: 'true' } })
  const resposta = lerEnvelope(bruto)
  return {
    itens: resposta.itens,
    total: resposta.total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(resposta.total / limite)),
  }
}

export async function obterItemAdmin(id) {
  if (CATALOGO_MOCK) return (await mock).obter(id)
  return chamar(`/produtos/${id}`, { parametros: { incluir_inativos: 'true' } })
}

export async function criarItem(dados) {
  if (CATALOGO_MOCK) return (await mock).criar(dados)
  return chamar('/produtos', { metodo: 'POST', corpo: dados })
}

export async function editarItem(id, dados) {
  if (CATALOGO_MOCK) return (await mock).editar(id, dados)
  return chamar(`/produtos/${id}`, { metodo: 'PATCH', corpo: dados })
}

export async function desativarItem(id) {
  if (CATALOGO_MOCK) return (await mock).desativar(id)
  return chamar(`/produtos/${id}`, { metodo: 'DELETE' })
}

export async function reativarItem(id) {
  if (CATALOGO_MOCK) return (await mock).reativar(id)
  return chamar(`/produtos/${id}/reativar`, { metodo: 'POST' })
}
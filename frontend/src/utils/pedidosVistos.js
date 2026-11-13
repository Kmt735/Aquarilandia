// Guarda quais pedidos o administrador já abriu, para contar só os novos.
// (No servidor, isso vira um campo do pedido; aqui fica no navegador de quem administra.)
const CHAVE = 'aquarilandia-admin-pedidos-vistos'
export const EVENTO_VISTOS = 'aquarilandia:pedidos-vistos'

export function lerVistos() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE)) ?? [])
  } catch {
    return new Set()
  }
}

export function marcarVisto(id) {
  const vistos = lerVistos().add(id)
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...vistos]))
  } catch {
    // armazenamento bloqueado: o aviso volta na próxima conferência
  }
  window.dispatchEvent(new Event(EVENTO_VISTOS))
}
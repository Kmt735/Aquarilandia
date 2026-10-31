// Rola até o elemento e faz um brilho rápido (usado pela busca). A cor vem do token --primary-text.
export function destacarElemento(id) {
  return setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const cor = getComputedStyle(document.documentElement).getPropertyValue('--primary-text').trim()
    el.animate([{ boxShadow: `0 0 0 3px ${cor}` }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1800 })
  }, 80)
}

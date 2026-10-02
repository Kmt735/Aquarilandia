// Rola até o elemento e faz um brilho rápido (usado pela busca)
export function destacarElemento(id) {
  return setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.animate(
      [{ boxShadow: '0 0 0 3px #00C2D6' }, { boxShadow: '0 0 0 0 transparent' }],
      { duration: 1800 },
    )
  }, 80)
}

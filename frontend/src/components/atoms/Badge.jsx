// Contador do carrinho: vermelho com texto branco (4,83:1), anel na cor da superfície para destacar do botão
export default function Badge({ children, animar = false }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-micro font-bold text-danger-foreground tabular-nums ring-2 ring-surface ${animar ? 'animate-bump' : ''}`}
    >
      {children}
    </span>
  )
}

// Contador do carrinho: vermelho com texto branco (4,8:1), anel na cor da superfície para destacar do botão
export default function Badge({ children, animar = false }) {
  return (
    <span
      className={`absolute -top-1.5 -right-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-danger-foreground tabular-nums ring-2 ring-surface ${animar ? 'animate-bump' : ''}`}
    >
      {children}
    </span>
  )
}

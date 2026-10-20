const estilos = {
  info: 'border-accent/60 bg-accent-soft text-foreground',
  alerta: 'border-danger/30 bg-danger/8 text-foreground',
  ok: 'border-primary/25 bg-surface-tint text-foreground',
}

export default function Hint({ tipo = 'info', children }) {
  return <div className={`mt-4 rounded-xl border px-3.5 py-3 text-[13px] leading-normal ${estilos[tipo]}`}>{children}</div>
}

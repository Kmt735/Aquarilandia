const estilos = {
  info: 'border-primary/25 bg-primary-soft text-foreground',
  alerta: 'border-danger/30 bg-danger/8 text-foreground',
  ok: 'border-neon/40 bg-neon/8 text-foreground',
}

export default function Hint({ tipo = 'info', children }) {
  return <div className={`mt-4 rounded-lg border px-3.5 py-3 text-[13px] leading-normal ${estilos[tipo]}`}>{children}</div>
}

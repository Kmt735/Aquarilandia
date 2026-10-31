// Estado vazio ou de erro: o que aconteceu + como resolver + ação (item 9)
export default function EmptyState({ icone, titulo, children, acoes, tom = 'vazio', className = '', ...props }) {
  const erro = tom === 'erro'
  return (
    <div
      role={erro ? 'alert' : undefined}
      className={`mx-auto w-full rounded-card border border-dashed px-6 py-12 text-center ${erro ? 'border-danger-text/50' : 'border-border-strong'} ${className}`}
      {...props}
    >
      {icone && (
        <div
          className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full [&_svg]:size-7 ${erro ? 'bg-danger-soft text-danger-text' : 'bg-surface-tint text-primary-text'}`}
        >
          {icone}
        </div>
      )}
      {titulo && <p className="mb-1.5 font-display text-h3 font-extrabold">{titulo}</p>}
      <div className="mx-auto max-w-[480px] text-corpo text-text-muted">{children}</div>
      {acoes && <div className="mt-6 flex flex-wrap justify-center gap-3">{acoes}</div>}
    </div>
  )
}

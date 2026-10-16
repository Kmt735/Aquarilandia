const proporcoes = { '4/3': 'aspect-[4/3]', '1/1': 'aspect-square', '16/10': 'aspect-[16/10]' }

// Moldura de imagem com proporção fixa e cantos arredondados. Hoje mostra um ícone no lugar da foto.
export default function Midia({ icone: Icone, rotulo, proporcao = '4/3', children, className = '' }) {
  return (
    <div
      className={`relative flex ${proporcoes[proporcao]} w-full items-center justify-center overflow-hidden bg-surface-muted ${className}`}
    >
      {Icone && <Icone aria-hidden="true" strokeWidth={1.25} className="size-12 text-primary-text/70 dark:text-neon/80" />}
      {rotulo && (
        <span className="absolute bottom-3 left-3 rounded-md bg-surface/90 px-2 py-1 text-[11px] font-medium text-text-muted">
          {rotulo}
        </span>
      )}
      {children}
    </div>
  )
}

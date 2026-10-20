const proporcoes = { '4/3': 'aspect-[4/3]', '1/1': 'aspect-square', '16/10': 'aspect-[16/10]' }

// Moldura de imagem com proporção fixa e fundo azul-claro. Hoje mostra um ícone no lugar da foto.
export default function Midia({ icone: Icone, rotulo, proporcao = '4/3', children, className = '' }) {
  return (
    <div
      className={`relative flex ${proporcoes[proporcao]} w-full items-center justify-center overflow-hidden bg-surface-tint ${className}`}
    >
      {Icone && <Icone aria-hidden="true" strokeWidth={1.5} className="size-14 text-primary-text" />}
      {rotulo && (
        <span className="absolute bottom-3 left-3 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-text-muted">
          {rotulo}
        </span>
      )}
      {children}
    </div>
  )
}

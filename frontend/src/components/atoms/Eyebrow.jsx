// Etiqueta em pílula acima dos títulos
const tons = {
  padrao: 'bg-primary-soft text-primary-text',
  claro: 'bg-on-primary-dark/15 text-on-primary-dark',
}

export default function Eyebrow({ children, tom = 'padrao', className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-legenda font-bold ${tons[tom]} ${className}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      {children}
    </div>
  )
}

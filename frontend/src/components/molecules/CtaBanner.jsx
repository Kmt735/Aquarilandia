// Faixa marinho arredondada (região comum, item 39). Bolhas em contorno no canto, só decoração.
export default function CtaBanner({ eyebrow, titulo, texto, acoes, children, className = '', nivel = 2 }) {
  const Titulo = `h${nivel}`
  return (
    <div className={`mx-auto max-w-[1200px] px-4 sm:px-6 desk:px-10 ${className}`}>
      <div className="relative flex flex-col items-start gap-6 overflow-hidden rounded-faixa border border-primary-text/25 bg-primary-dark px-6 py-9 text-on-primary-dark shadow-glow desk:flex-row desk:items-center desk:justify-between desk:px-12 desk:py-12">
        <svg aria-hidden="true" viewBox="0 0 120 80" className="pointer-events-none absolute top-3 right-4 w-20 text-primary-text/60 desk:top-4 desk:right-6">
          <circle cx="96" cy="22" r="14" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="62" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="74" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
        <div className="relative max-w-[600px]">
          {eyebrow && <p className="mb-3 text-pequeno font-bold text-accent">{eyebrow}</p>}
          <Titulo className="text-h2 text-on-primary-dark">{titulo}</Titulo>
          {texto && <p className="mt-3 text-corpo text-on-primary-dark-muted">{texto}</p>}
          {children}
        </div>
        {acoes && <div className="relative flex shrink-0 flex-wrap gap-3">{acoes}</div>}
      </div>
    </div>
  )
}

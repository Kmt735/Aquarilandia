import Button from '../atoms/Button'
import WhatsAppIcon from '../icons/WhatsAppIcon'

// Faixa marinho arredondada com botão amarelo. Bolhas chapadas no canto superior, só decoração.
export default function CtaBanner({ eyebrow, titulo, texto, acao, onAcao, whatsapp = false, children, className = '' }) {
  return (
    <div className={`mx-auto max-w-[1200px] px-4 sm:px-6 desk:px-10 ${className}`}>
      <div className="relative flex flex-col items-start gap-6 overflow-hidden rounded-[24px] bg-primary-dark px-7 py-9 text-on-primary-dark desk:flex-row desk:items-center desk:justify-between desk:px-12 desk:py-12">
        <svg aria-hidden="true" viewBox="0 0 120 80" className="pointer-events-none absolute top-3 right-4 w-20 text-primary desk:top-4 desk:right-6">
          <circle cx="96" cy="22" r="14" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="62" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="74" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
        <div className="relative max-w-[560px]">
          {eyebrow && <div className="mb-3 text-[13px] font-bold text-accent">{eyebrow}</div>}
          <h2 className="text-[26px] leading-tight text-white desk:text-[32px]">{titulo}</h2>
          {texto && <p className="mt-3 text-[16px] leading-relaxed text-white/80">{texto}</p>}
          {children}
        </div>
        <Button variant="accent" className="relative shrink-0" onClick={onAcao}>
          {whatsapp && <WhatsAppIcon />}
          {acao}
        </Button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { iconeCategoria } from '@/lib/icones'

const PROPORCOES = { '4/3': 'aspect-[4/3]', '1/1': 'aspect-square', '16/10': 'aspect-[16/10]' }

// Moldura de imagem com proporção fixa. Sem foto (ou se ela falhar), mostra uma cena ilustrada do aquário
// com o ícone da categoria — pronta para receber a foto real (`src`) sem mudar o layout (itens 6 e 26).
export default function Imagem({ src, alt = '', categoria, proporcao = '4/3', className = '', children, compacta = false }) {
  const [falhouEm, setFalhouEm] = useState(null)
  const temFoto = Boolean(src) && falhouEm !== src

  return (
    <div className={`relative w-full overflow-hidden bg-surface-tint ${PROPORCOES[proporcao]} ${className}`}>
      {temFoto ? (
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhouEm(src)} className="size-full object-cover" />
      ) : (
        <Cena categoria={categoria} compacta={compacta} />
      )}
      {children}
    </div>
  )
}

function Cena({ categoria, compacta }) {
  const Icone = iconeCategoria[categoria] ?? iconeCategoria.Peixes
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {/* luz da luminária vindo de cima */}
        <path d="M120 0 L280 0 L330 300 L70 300 Z" fill="var(--primary-soft)" opacity="0.55" />
        {/* linhas de água */}
        <path d="M0 40 C60 30 120 50 200 40 S340 30 400 40" fill="none" stroke="var(--border-strong)" strokeWidth="2" opacity="0.8" />
        {/* plantas */}
        <g fill="var(--primary)" opacity="0.28">
          <path d="M40 262 C30 220 34 180 52 150 C60 190 58 230 52 262 Z" />
          <path d="M58 264 C64 226 80 200 100 186 C92 220 80 246 68 266 Z" />
          <path d="M352 262 C344 228 348 196 362 170 C370 204 368 236 362 262 Z" />
        </g>
        {/* substrato */}
        <path d="M0 262 C80 250 140 268 210 260 S330 248 400 262 V300 H0 Z" fill="var(--accent)" opacity="0.35" />
        {/* bolhas */}
        <g fill="none" stroke="var(--primary-text)" strokeWidth="2" opacity="0.5">
          <circle cx="300" cy="90" r="6" />
          <circle cx="312" cy="118" r="3.5" />
          <circle cx="96" cy="100" r="4.5" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className={`flex items-center justify-center rounded-full bg-surface/80 text-primary-text shadow-soft ring-1 ring-border-strong ${compacta ? 'size-9' : 'size-16'}`}>
          <Icone strokeWidth={1.6} className={compacta ? 'size-5' : 'size-8'} />
        </span>
        {!compacta && <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-micro font-semibold text-text-muted">Foto em breve</span>}
      </div>
    </div>
  )
}

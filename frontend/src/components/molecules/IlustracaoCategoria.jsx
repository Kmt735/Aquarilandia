// Mini-cenas chapadas das categorias principais, no traço da IlustracaoAquario. Só tokens do tema. Decorativas.
const Bolhas = () => (
  <g fill="none" stroke="var(--primary-text)" strokeWidth="2">
    <circle cx="96" cy="18" r="5" />
    <circle cx="108" cy="34" r="3" />
    <circle cx="86" cy="8" r="2.5" />
  </g>
)

const CENAS = {
  Peixes: (
    <>
      <path d="M28 46 L8 30 V62 Z" fill="var(--accent)" />
      <ellipse cx="54" cy="46" rx="32" ry="20" fill="var(--accent)" />
      <circle cx="72" cy="40" r="4" fill="var(--primary-dark)" />
      <path d="M50 30 q9 16 0 32" fill="none" stroke="var(--primary-dark)" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
      <Bolhas />
    </>
  ),
  Aquários: (
    <>
      <rect x="10" y="14" width="100" height="62" rx="9" fill="var(--primary-soft)" stroke="var(--primary-text)" strokeWidth="3" />
      <rect x="4" y="8" width="112" height="9" rx="4" fill="var(--primary-text)" />
      <rect x="12" y="62" width="96" height="12" rx="5" fill="var(--accent)" />
      <path d="M58 48 L46 40 V56 Z" fill="var(--primary-text)" />
      <ellipse cx="72" cy="48" rx="16" ry="10" fill="var(--primary-text)" />
      <path d="M26 64 C21 52 23 42 29 34 C33 46 32 56 31 64 Z" fill="var(--primary)" />
    </>
  ),
  Plantas: (
    <g fill="var(--primary)">
      <path d="M58 78 C44 58 42 34 54 10 C68 32 70 58 62 78 Z" />
      <path d="M50 78 C34 70 22 54 18 34 C38 40 50 56 56 76 Z" fill="var(--primary-text)" />
      <path d="M66 78 C82 70 96 54 100 36 C80 42 68 56 62 76 Z" fill="var(--primary-text)" />
      <rect x="30" y="74" width="60" height="6" rx="3" fill="var(--accent)" />
    </g>
  ),
  Filtros: (
    <>
      <rect x="34" y="6" width="52" height="58" rx="9" fill="var(--primary-text)" />
      <rect x="44" y="18" width="32" height="5" rx="2.5" fill="var(--primary-soft)" />
      <rect x="44" y="30" width="32" height="5" rx="2.5" fill="var(--primary-soft)" />
      <rect x="44" y="42" width="32" height="5" rx="2.5" fill="var(--primary-soft)" />
      <path d="M46 66 c-7 9 -7 14 0 14 s7 -5 0 -14 Z" fill="var(--accent)" />
      <path d="M74 66 c-7 9 -7 14 0 14 s7 -5 0 -14 Z" fill="var(--accent)" />
    </>
  ),
}

export default function IlustracaoCategoria({ nome, className = '' }) {
  return (
    <svg viewBox="0 0 120 84" className={className} aria-hidden="true" focusable="false">
      {CENAS[nome]}
    </svg>
  )
}

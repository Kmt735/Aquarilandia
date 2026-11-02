// Mini-cena chapada de cada passo do guia: mesmo aquário, um detalhe diferente. Só tokens do tema. Decorativa.
const Peixe = ({ x, y, cor = 'var(--accent)' }) => (
  <g transform={`translate(${x} ${y})`} fill={cor}>
    <ellipse cx="9" cy="6" rx="9" ry="6" />
    <path d="M16 6 L25 0 V12 Z" />
  </g>
)

const Bolhas = ({ x, y }) => (
  <g fill="none" stroke="var(--primary-text)" strokeWidth="1.5">
    <circle cx={x} cy={y} r="3" />
    <circle cx={x + 6} cy={y - 10} r="2" />
    <circle cx={x - 1} cy={y - 18} r="2.5" />
  </g>
)

const CENAS = {
  equipamentos: (
    <>
      <rect x="84" y="24" width="16" height="30" rx="4" fill="var(--primary-text)" />
      <rect x="88" y="30" width="8" height="3" rx="1.5" fill="var(--surface)" />
      <rect x="88" y="37" width="8" height="3" rx="1.5" fill="var(--surface)" />
      <Bolhas x={74} y={50} />
    </>
  ),
  ciclagem: (
    <>
      <Bolhas x={36} y={56} />
      <Bolhas x={60} y={50} />
      <Bolhas x={84} y={56} />
    </>
  ),
  'qualidade-da-agua': (
    <>
      <rect x="54" y="20" width="12" height="38" rx="6" fill="var(--surface)" stroke="var(--primary-text)" strokeWidth="2" />
      <rect x="57" y="38" width="6" height="17" rx="3" fill="var(--accent)" />
    </>
  ),
  'escolha-dos-peixes': (
    <>
      <Peixe x={30} y={30} />
      <Peixe x={68} y={44} cor="var(--primary-text)" />
      <Bolhas x={94} y={42} />
    </>
  ),
  manutencao: (
    <>
      <Peixe x={40} y={36} />
      <path d="M78 36 l8 8 l14 -16" fill="none" stroke="var(--primary-text)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
}

export default function IlustracaoPasso({ id, className = '' }) {
  return (
    <svg viewBox="0 0 120 88" className={className} aria-hidden="true" focusable="false">
      <rect x="6" y="8" width="108" height="72" rx="10" fill="var(--primary-soft)" stroke="var(--primary-text)" strokeWidth="3" />
      <rect x="8" y="64" width="104" height="14" rx="6" fill="var(--accent-soft)" />
      <path d="M22 66 C18 56 20 48 25 42 C28 52 27 60 26 66 Z" fill="var(--primary)" />
      {CENAS[id]}
    </svg>
  )
}

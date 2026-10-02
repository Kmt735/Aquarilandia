const tons = { gold: 'text-gold', cyan: 'text-cyan' }

export default function Eyebrow({ children, tom = 'gold', className = '' }) {
  return (
    <div className={`font-mono text-xs uppercase tracking-[.14em] ${tons[tom]} ${className}`}>
      {children}
    </div>
  )
}

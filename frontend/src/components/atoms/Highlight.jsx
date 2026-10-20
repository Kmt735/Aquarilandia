// Ênfase em títulos: palavra em azul com um traço amarelo, chapado, logo abaixo
export default function Highlight({ children, bloco = false, className = '' }) {
  return (
    <span className={`${bloco ? 'block' : 'inline-block'} ${className}`}>
      <span className="relative inline-block text-primary-text">
        <svg
          aria-hidden="true"
          viewBox="0 0 200 14"
          preserveAspectRatio="none"
          className="absolute -bottom-[0.06em] left-[-2%] h-[0.28em] w-[104%] text-accent"
        >
          <path d="M3 9.5C45 3.5 120 2 197 6.5" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        </svg>
        <span className="relative">{children}</span>
      </span>
    </span>
  )
}

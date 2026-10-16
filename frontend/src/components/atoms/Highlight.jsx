// Ênfase em azul dentro de títulos (substitui o destaque manuscrito)
export default function Highlight({ children, bloco = false, className = '' }) {
  return <span className={`text-primary-text ${bloco ? 'block' : ''} ${className}`}>{children}</span>
}

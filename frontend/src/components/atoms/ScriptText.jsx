const cores = { cyan: 'text-cyan', gold: 'text-gold' }

// Destaque manuscrito (fonte Caveat) usado nos títulos
export default function ScriptText({ children, cor = 'cyan', bloco = false, className = '' }) {
  return (
    <span className={`font-script font-bold ${cores[cor]} ${bloco ? 'block' : ''} ${className}`}>
      {children}
    </span>
  )
}

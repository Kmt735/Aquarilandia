import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import Input from './Input'

// Senha com mostrar/ocultar (item 5 · prevenção de erros de digitação)
export default function CampoSenha({ className = '', ...props }) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="relative">
      <Input type={visivel ? 'text' : 'password'} className={`pr-12 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-r-xl text-text-muted transition-colors hover:text-primary-text"
      >
        {visivel ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
      </button>
    </div>
  )
}

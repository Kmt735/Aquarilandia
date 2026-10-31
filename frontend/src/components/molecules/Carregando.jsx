import Spinner from '../atoms/Spinner'

// Fallback enquanto uma tela carregada sob demanda chega
export default function Carregando() {
  return (
    <div role="status" className="flex min-h-[60vh] items-center justify-center gap-3 text-pequeno text-text-muted">
      <Spinner className="text-primary-text" />
      Carregando…
    </div>
  )
}

import { CircleX, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

// Aviso de compatibilidade do "Monte seu Aquário". Nunca bloqueia; sempre diz o porquê e como resolver.
// Nível com ícone + texto ("Atenção" / "Incompatível"), nunca só pela cor.
const NIVEIS = {
  atencao: { Icone: TriangleAlert, rotulo: 'Atenção', caixa: 'border-warning-text/40 bg-warning-soft', cor: 'text-warning-text' },
  incompativel: { Icone: CircleX, rotulo: 'Incompatível', caixa: 'border-danger-text/40 bg-danger-soft', cor: 'text-danger-text' },
}

export function SeloNivel({ nivel, children, className = '' }) {
  const { Icone, rotulo, cor } = NIVEIS[nivel]
  return (
    <span className={cn('inline-flex items-center gap-1 text-micro font-extrabold tracking-wide uppercase', cor, className)}>
      <Icone aria-hidden="true" className="size-3.5" />
      {children ?? rotulo}
    </span>
  )
}

// `compacto`: dentro do card do item — título visível e o porquê/como resolver num "Por quê?" expansível
export default function CompatibilityWarning({ aviso, compacto = false, acao, className = '' }) {
  const { caixa } = NIVEIS[aviso.nivel]
  if (compacto) {
    return (
      <details className={cn('group/aviso rounded-lg border px-3 py-2 text-legenda', caixa, className)}>
        <summary className="alvo-toque cursor-pointer list-none">
          <SeloNivel nivel={aviso.nivel} />
          <span className="mt-0.5 block font-bold text-foreground">{aviso.titulo}</span>
          <span className="text-primary-text underline underline-offset-2 group-open/aviso:hidden">Por quê?</span>
        </summary>
        <p className="mt-1 text-foreground">{aviso.motivo}</p>
        <p className="mt-1 text-foreground"><strong>Como resolver:</strong> {aviso.solucao}</p>
      </details>
    )
  }
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-pequeno text-foreground', caixa, className)}>
      <SeloNivel nivel={aviso.nivel} />
      <p className="mt-1 font-bold">{aviso.titulo}</p>
      <p className="mt-1">{aviso.motivo}</p>
      <p className="mt-1"><strong>Como resolver:</strong> {aviso.solucao}</p>
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

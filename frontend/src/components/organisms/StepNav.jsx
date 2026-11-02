import { Check, ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import ProgressBar from '../atoms/ProgressBar'

function ListaPassos({ passos, ativo, entendidos, onEscolher }) {
  return (
    <ol className="space-y-1">
      {passos.map((p, i) => {
        const atual = p.id === ativo
        const entendido = entendidos.includes(p.id)
        return (
          <li key={p.id}>
            <a
              href={`#${p.id}`}
              aria-current={atual ? 'step' : undefined}
              onClick={(e) => {
                e.preventDefault()
                onEscolher(p.id)
              }}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-1.5 text-pequeno transition-colors hover:bg-surface-tint',
                atual ? 'bg-primary-soft font-bold text-foreground' : 'text-text-muted',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-legenda font-extrabold tabular-nums',
                  atual ? 'border-primary bg-primary text-primary-foreground' : 'border-border-control bg-surface text-primary-text',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{p.titulo}</span>
              {entendido && (
                <>
                  <Check aria-hidden="true" className="size-4 shrink-0 text-primary-text" />
                  <span className="sr-only">(entendido)</span>
                </>
              )}
            </a>
          </li>
        )
      })}
    </ol>
  )
}

// Navegação do guia: lateral fixa no desktop; barra compacta com menu no celular
export default function StepNav({ passos, ativo, entendidos, onIr }) {
  const [aberto, setAberto] = useState(false)
  const destino = useRef(null) // a rolagem espera a gaveta fechar e soltar a página
  const indice = Math.max(0, passos.findIndex((p) => p.id === ativo))
  const progresso = (indice + 1) / passos.length
  const legenda = `Passo ${indice + 1} de ${passos.length}`

  return (
    <>
      <nav aria-label="Passos do guia" className="sticky top-[calc(72px+1.5rem)] mt-14 hidden self-start desk:block">
        <p className="mb-3 px-2.5 text-pequeno font-bold">{legenda}</p>
        <ListaPassos passos={passos} ativo={ativo ?? passos[0].id} entendidos={entendidos} onEscolher={onIr} />
        <div className="mt-4 px-2.5">
          <ProgressBar valor={progresso} rotulo="Progresso no guia" />
        </div>
      </nav>

      <nav aria-label="Passos do guia" className="sticky top-16 z-30 -mx-4 border-b border-border bg-surface/95 backdrop-blur sm:-mx-6 desk:hidden">
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-pequeno font-bold sm:px-6">
            <span className="min-w-0 truncate">
              {legenda} · {passos[indice].titulo}
            </span>
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl pb-4"
            onCloseAutoFocus={(e) => {
              if (!destino.current) return
              e.preventDefault()
              onIr(destino.current)
              destino.current = null
            }}
          >
            <SheetHeader className="pb-0">
              <SheetTitle className="font-display text-h3">Passos do guia</SheetTitle>
              <SheetDescription className="sr-only">Escolha um passo para ir até ele.</SheetDescription>
            </SheetHeader>
            <div className="px-3">
              <ListaPassos
                passos={passos}
                ativo={ativo ?? passos[0].id}
                entendidos={entendidos}
                onEscolher={(id) => {
                  destino.current = id
                  setAberto(false)
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
        <ProgressBar valor={progresso} rotulo="Progresso no guia" />
      </nav>
    </>
  )
}

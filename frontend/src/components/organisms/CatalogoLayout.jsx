import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import Button from '../atoms/Button'
import ActiveFilter from '../molecules/ActiveFilter'
import CampoBusca from '../molecules/CampoBusca'
import OrdenarPor from '../molecules/OrdenarPor'
import { Accordion } from '@/components/ui/accordion'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { plural } from '../../utils/format'

// Estrutura das listagens (Loja e Peixes): busca, filtros, ordenação, contagem e grade (item 7).
// - Desktop: barra lateral com seções recolhíveis (acordeão), fixa ao rolar.
// - Celular: botão "Filtros (n)" abre uma gaveta por baixo; a lista continua visível atrás,
//   e o rodapé da gaveta tem "Limpar" e "Ver X produtos".
// `filtros` são <SecaoFiltro>; `secoesAbertas` diz quais começam abertas.
// `ativos` = [{ id, rotulo, onRemover }] — viram chips acima da lista (o id "busca" não conta no botão).
export default function CatalogoLayout({ busca, onBusca, rotuloBusca, ordem, onOrdem, filtros, secoesAbertas = [], ativos, onLimpar, total, carregando, unidade, children }) {
  const [gaveta, setGaveta] = useState(false)
  const qtdFiltros = ativos.filter((a) => a.id !== 'busca').length
  const totalTexto = plural(total, unidade.singular, unidade.plural)
  const contagem = carregando ? `Buscando ${unidade.plural}…` : totalTexto

  const painel = (
    <Accordion type="multiple" defaultValue={secoesAbertas}>
      {filtros}
    </Accordion>
  )

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 desk:flex-row desk:px-10 desk:py-12">
      <aside aria-labelledby="titulo-filtros" className="hidden w-[260px] shrink-0 desk:block">
        <div className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col rounded-card border border-border-strong bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
            <h2 id="titulo-filtros" className="text-h4">
              Filtros
            </h2>
            {qtdFiltros > 0 && (
              <Button variant="terciario" tamanho="sm" className="min-h-11" onClick={onLimpar}>
                Limpar ({qtdFiltros})
              </Button>
            )}
          </div>
          <div className="overflow-y-auto overscroll-contain px-5">{painel}</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CampoBusca valor={busca} onChange={onBusca} rotulo={rotuloBusca} placeholder={`${rotuloBusca}…`} />
          <div className="flex items-center gap-3">
            <Button variant="secundario" className="h-11 shrink-0 desk:hidden" onClick={() => setGaveta(true)} aria-haspopup="dialog">
              <SlidersHorizontal aria-hidden="true" />
              Filtros{qtdFiltros > 0 && ` (${qtdFiltros})`}
            </Button>
            <div className="min-w-0 flex-1 sm:flex-none">
              <OrdenarPor valor={ordem} onChange={onOrdem} />
            </div>
          </div>
        </div>

        <p role="status" aria-atomic="true" className="mb-3 font-display text-corpo font-extrabold text-foreground">
          {contagem}
        </p>
        <ActiveFilter filtros={ativos} onLimpar={onLimpar} />
        {children}
      </div>

      <Sheet open={gaveta} onOpenChange={setGaveta}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-3xl bg-surface p-0">
          <SheetHeader className="border-b border-border px-5 py-4 pr-16">
            <SheetTitle className="font-display text-h3 font-extrabold">Filtros{qtdFiltros > 0 && ` (${qtdFiltros})`}</SheetTitle>
            <SheetDescription className="text-pequeno text-text-muted">A lista atrás muda assim que você escolhe uma opção.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">{painel}</div>
          <div className="flex gap-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="secundario" className="h-11" onClick={onLimpar} disabled={!qtdFiltros}>
              Limpar
            </Button>
            <Button className="h-11 flex-1" onClick={() => setGaveta(false)}>
              {carregando ? 'Buscando…' : `Ver ${totalTexto}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

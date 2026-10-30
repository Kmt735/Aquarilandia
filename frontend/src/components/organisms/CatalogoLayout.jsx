import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import Button from '../atoms/Button'
import ActiveFilter from '../molecules/ActiveFilter'
import CampoBusca from '../molecules/CampoBusca'
import OrdenarPor from '../molecules/OrdenarPor'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { plural } from '../../utils/format'

// Estrutura das listagens (Loja e Peixes): busca, filtros, ordenação, contagem e grade (item 7).
// No desktop os filtros ficam ao lado; no celular, numa gaveta com o botão "Filtros (n)".
export default function CatalogoLayout({ busca, onBusca, rotuloBusca, ordem, onOrdem, filtros, ativos, onLimpar, total, carregando, unidade, children }) {
  const [gaveta, setGaveta] = useState(false)
  const contagem = carregando ? 'Carregando…' : `${plural(total, unidade.singular, unidade.plural)} ${total === 1 ? 'encontrado' : 'encontrados'}`

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 desk:flex-row desk:px-10 desk:py-12">
      <aside aria-labelledby="titulo-filtros" className="hidden w-[250px] shrink-0 desk:block">
        <div className="sticky top-24 rounded-card border border-border-strong bg-surface p-5">
          <h2 id="titulo-filtros" className="mb-4 text-h4">
            Filtros
          </h2>
          {filtros}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <CampoBusca valor={busca} onChange={onBusca} rotulo={rotuloBusca} placeholder={`${rotuloBusca}…`} />
          <div className="flex gap-3">
            <Button variant="secundario" className="h-12 flex-1 desk:hidden" onClick={() => setGaveta(true)}>
              <SlidersHorizontal aria-hidden="true" />
              Filtros{ativos.length > 0 && ` (${ativos.length})`}
            </Button>
            <div className="flex-1 sm:flex-none">
              <OrdenarPor valor={ordem} onChange={onOrdem} />
            </div>
          </div>
        </div>

        <p aria-live="polite" className="mb-3 text-pequeno font-semibold text-text-muted">
          {contagem}
        </p>
        <ActiveFilter partes={ativos} onLimpar={onLimpar} />
        {children}
      </div>

      <Sheet open={gaveta} onOpenChange={setGaveta}>
        <SheetContent side="left" className="w-[340px] max-w-[90vw] gap-0 bg-surface p-0">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="font-display text-h3 font-extrabold">Filtros</SheetTitle>
            <SheetDescription className="sr-only">Os resultados mudam assim que você escolhe uma opção.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-5 py-4">{filtros}</div>
          <div className="flex gap-2 border-t border-border p-4">
            <Button variant="secundario" onClick={onLimpar} disabled={!ativos.length}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setGaveta(false)}>
              Ver {carregando ? 'resultados' : plural(total, 'resultado')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

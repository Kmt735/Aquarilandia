import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Kbd from '../atoms/Kbd'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import SearchResult from '../molecules/SearchResult'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import useConsulta from '../../hooks/useConsulta'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { buscar } from '../../utils/busca'

// Item 33 lupa · H7 atalho "/" · combobox com setas ↑↓ e Enter · H9 busca vazia sempre oferece uma saída
export default function SearchBox() {
  const [consulta, setConsulta] = useState('')
  const [ativo, setAtivo] = useState(0)
  const { fecharPaineis, devolverFoco } = useUI()
  const navigate = useNavigate()
  const abrirWhatsApp = useWhatsApp()

  const termo = consulta.trim()
  const { dados, carregando, erro, recarregar } = useConsulta(() => buscar(consulta), [consulta])
  const resultados = carregando || erro ? [] : (dados ?? [])
  const indice = Math.min(ativo, Math.max(resultados.length - 1, 0))

  const abrir = (resultado) => {
    fecharPaineis()
    navigate(resultado.to, { state: resultado.state })
  }

  const teclar = (e) => {
    if (e.key === 'ArrowDown' && resultados.length) {
      e.preventDefault()
      setAtivo((indice + 1) % resultados.length)
    } else if (e.key === 'ArrowUp' && resultados.length) {
      e.preventDefault()
      setAtivo((indice - 1 + resultados.length) % resultados.length)
    } else if (e.key === 'Enter' && resultados[indice]) {
      e.preventDefault()
      abrir(resultados[indice])
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <DialogContent showCloseButton={false} onCloseAutoFocus={devolverFoco} className="top-20 translate-y-0 gap-0 rounded-[20px] border-border-strong bg-surface-elevated p-3 sm:max-w-[600px]">
        <DialogTitle className="sr-only">Buscar no site</DialogTitle>
        <DialogDescription className="sr-only">Digite e use as setas para escolher uma sugestão.</DialogDescription>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            role="combobox"
            aria-expanded={resultados.length > 0}
            aria-controls="sugestoes-busca"
            aria-activedescendant={resultados.length ? `sugestao-${indice}` : undefined}
            aria-autocomplete="list"
            aria-label="Buscar produtos, peixes ou categorias"
            autoFocus
            autoComplete="off"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              setAtivo(0)
            }}
            onKeyDown={teclar}
            placeholder="Buscar produtos, peixes ou categorias…"
            className="h-12 w-full rounded-full border border-border-control bg-surface pr-4 pl-12 text-corpo text-foreground outline-none placeholder:text-text-muted focus-visible:border-primary-text focus-visible:shadow-glow"
          />
        </div>

        <p aria-live="polite" className="mx-1 mt-3 mb-2 text-legenda text-text-muted">
          {!termo && (
            <>
              Sugestões · aperte <Kbd>/</Kbd> em qualquer tela para buscar
            </>
          )}
          {termo && resultados.length > 0 && `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'} · use ↑ ↓ e Enter`}
        </p>

        {carregando ? <p role="status" className="p-3 text-pequeno">Buscando no catálogo…</p> : erro ? <p role="alert" className="p-3 text-pequeno">Não conseguimos consultar o catálogo. <Button variant="secundario" onClick={recarregar}>Tentar de novo</Button></p> : termo && resultados.length === 0 ? (
          <div className="px-1.5 pt-1 pb-2 text-pequeno text-text-muted">
            Não encontramos <strong className="text-foreground">“{termo}”</strong> no site. Confira a grafia ou tente algo mais geral, como “filtro” ou “betta”. A loja pode ter o item mesmo que ele ainda não esteja no site.
            <Button
              variant="secundario"
              className="mt-3"
              onClick={() => {
                fecharPaineis()
                abrirWhatsApp(`“${termo}”`)
              }}
            >
              <WhatsAppIcon className="size-[18px]" />
              Perguntar no WhatsApp
            </Button>
          </div>
        ) : (
          <ul id="sugestoes-busca" role="listbox" aria-label="Sugestões" className="flex flex-col gap-0.5">
            {resultados.map((r, i) => (
              <SearchResult key={`${r.tipo}-${r.rotulo}`} id={`sugestao-${i}`} resultado={r} selecionado={i === indice} onClick={() => abrir(r)} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

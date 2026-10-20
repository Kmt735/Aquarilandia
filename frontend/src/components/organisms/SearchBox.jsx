import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Kbd from '../atoms/Kbd'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import SearchResult from '../molecules/SearchResult'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { buscar } from '../../utils/busca'

// H4 lupa · H7 atalho "/" · H9 busca sem resultado sempre oferece uma saída
export default function SearchBox() {
  const [consulta, setConsulta] = useState('')
  const { fecharPaineis } = useUI()
  const navigate = useNavigate()
  const abrirWhatsApp = useWhatsApp()

  const termo = consulta.trim()
  const resultados = buscar(consulta)

  const abrir = (resultado) => {
    fecharPaineis()
    navigate(resultado.to, { state: resultado.state })
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <DialogContent
        showCloseButton={false}
        className="top-[96px] translate-y-0 gap-0 rounded-[20px] border-border bg-surface-elevated p-3 sm:max-w-[580px]"
      >
      <DialogTitle className="sr-only">Buscar</DialogTitle>
      <DialogDescription className="sr-only">Busque produtos, peixes ou categorias</DialogDescription>
      <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        autoFocus
        autoComplete="off"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && resultados[0] && abrir(resultados[0])}
        placeholder="Buscar produtos, peixes ou categorias…"
        className="w-full rounded-full border border-border-strong bg-surface py-3.5 pr-4 pl-11 text-[16px] text-foreground outline-none placeholder:text-text-muted focus:border-primary focus:ring-[3px] focus:ring-primary/20 dark:focus:border-primary-text"
      />
      </div>

      <div className="mx-1 mt-3 mb-2 text-[12px] text-text-muted">
        {!termo && (
          <>
            Atalhos rápidos · aperte <Kbd>/</Kbd> em qualquer tela para buscar
          </>
        )}
        {termo && resultados.length > 0 &&
          `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'} · Enter abre o primeiro`}
      </div>

      {termo && resultados.length === 0 ? (
        <div className="px-1.5 pt-3 pb-2 text-[14px] leading-relaxed text-text-muted">
          Não encontramos <strong className="text-foreground">“{termo}”</strong> no site.
          <br />
          Confira a grafia ou tente algo mais geral, como “filtro” ou “betta”. A loja pode ter o item mesmo que ele
          ainda não esteja cadastrado aqui.
          <br />
          <Button
            variant="accent"
            className="mt-3"
            onClick={() => {
              fecharPaineis()
              abrirWhatsApp(`perguntando sobre “${termo}”`)
            }}
          >
            <WhatsAppIcon />
            Perguntar no WhatsApp
          </Button>
        </div>
      ) : (
        resultados.map((r, i) => (
          <SearchResult key={`${r.tipo}-${r.rotulo}`} resultado={r} selecionado={i === 0 && Boolean(termo)} onClick={() => abrir(r)} />
        ))
      )}
      </DialogContent>
    </Dialog>
  )
}

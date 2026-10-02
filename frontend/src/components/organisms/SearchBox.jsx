import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Kbd from '../atoms/Kbd'
import SearchResult from '../molecules/SearchResult'
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
    <div
      role="dialog"
      aria-label="Buscar"
      className="fixed top-[84px] left-1/2 z-[310] w-[560px] max-w-[92vw] -translate-x-1/2 rounded-2xl border border-line bg-panel p-4 shadow-[0_20px_50px_rgba(0,0,0,.5)]"
    >
      <input
        type="search"
        autoFocus
        autoComplete="off"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && resultados[0] && abrir(resultados[0])}
        placeholder="Buscar produtos, peixes ou categorias…"
        className="w-full rounded-[10px] border border-line bg-abyss px-4 py-3.5 font-sans text-[15px] text-ink outline-none focus:border-cyan"
      />

      <div className="mx-0.5 mt-2.5 mb-1.5 font-mono text-[11px] text-ink-soft">
        {!termo && (
          <>
            Atalhos rápidos · aperte <Kbd>/</Kbd> em qualquer tela para buscar
          </>
        )}
        {termo && resultados.length > 0 &&
          `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'} · Enter abre o primeiro`}
      </div>

      {termo && resultados.length === 0 ? (
        <div className="px-1.5 pt-4 pb-1.5 text-[13.5px] leading-[1.55] text-ink-soft">
          Não encontramos <strong className="text-ink">“{termo}”</strong> no site.
          <br />
          Confira a grafia ou tente algo mais geral, como “filtro” ou “betta”. A loja pode ter o item mesmo que ele
          ainda não esteja cadastrado aqui.
          <br />
          <Button
            className="mt-3"
            onClick={() => {
              fecharPaineis()
              abrirWhatsApp(`perguntando sobre “${termo}”`)
            }}
          >
            💬 Perguntar no WhatsApp
          </Button>
        </div>
      ) : (
        resultados.map((r, i) => (
          <SearchResult key={`${r.tipo}-${r.rotulo}`} resultado={r} selecionado={i === 0 && Boolean(termo)} onClick={() => abrir(r)} />
        ))
      )}
    </div>
  )
}

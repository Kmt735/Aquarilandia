import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { categorias } from '../../data/categorias'
import { urlLoja } from '../../utils/rotas'

// H7 · Atalho para as categorias da loja (abre no hover ou no clique)
export default function NavDropdown({ ativo }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!aberto) return
    const clicarFora = (e) => !ref.current?.contains(e.target) && setAberto(false)
    const teclar = (e) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('click', clicarFora)
    document.addEventListener('keydown', teclar)
    return () => {
      document.removeEventListener('click', clicarFora)
      document.removeEventListener('keydown', teclar)
    }
  }, [aberto])

  const irPara = (categoria) => {
    setAberto(false)
    navigate(urlLoja({ categoria }))
  }

  const item = 'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-soft transition hover:bg-panel hover:text-cyan'

  return (
    <div ref={ref} className="group relative">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        data-h="H7 Atalho p/ categorias"
        className={`flex items-center gap-[5px] text-sm group-hover:text-white ${ativo || aberto ? 'text-white' : 'text-ink-muted'}`}
      >
        Loja <span className={`text-[10px] transition-transform ${aberto ? 'rotate-180' : ''}`}>▾</span>
      </button>
      <div
        className={`absolute top-[calc(100%+18px)] left-1/2 grid w-[340px] -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-line bg-panel-2 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,.5)] transition-all duration-150 before:absolute before:inset-x-0 before:-top-[18px] before:h-[18px] ${
          aberto
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1.5 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100'
        }`}
      >
        {categorias.map((c) => (
          <button key={c.nome} type="button" className={item} onClick={() => irPara(c.nome)}>
            <span className="text-sm">{c.icone}</span>
            {c.nome}
          </button>
        ))}
        <button
          type="button"
          onClick={() => irPara()}
          className={`${item} col-span-full mt-1 justify-center border-t border-line pt-2.5 font-bold text-gold!`}
        >
          Ver loja completa →
        </button>
      </div>
    </div>
  )
}

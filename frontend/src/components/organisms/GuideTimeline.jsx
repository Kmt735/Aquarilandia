import { useEffect, useRef } from 'react'
import TimelineItem from '../molecules/TimelineItem'

export default function GuideTimeline({ passos, passoAtual }) {
  const itens = useRef([])
  const guiando = passoAtual >= 0

  useEffect(() => {
    if (passoAtual < 0) return
    // pequeno atraso para não brigar com o scroll-to-top da troca de rota
    const timer = setTimeout(
      () => itens.current[passoAtual]?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      120,
    )
    return () => clearTimeout(timer)
  }, [passoAtual])

  return (
    <ol className="mx-auto my-16 max-w-[1200px] px-4 sm:px-6 desk:px-10">
      {passos.map((passo, i) => (
        <li key={passo.titulo} className="max-w-[720px]">
          <TimelineItem
            ref={(el) => {
              itens.current[i] = el
            }}
            numero={i + 1}
            passo={passo}
            guiando={guiando}
            estado={i === passoAtual ? 'atual' : i < passoAtual ? 'feito' : null}
            ultimo={i === passos.length - 1}
          />
        </li>
      ))}
    </ol>
  )
}

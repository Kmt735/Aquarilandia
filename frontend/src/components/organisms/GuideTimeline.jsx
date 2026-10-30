import { useEffect, useRef } from 'react'
import TimelineItem from '../molecules/TimelineItem'

// Linha do tempo do guia. A etapa atual ganha destaque pelo número (sem apagar as outras: contraste AA)
export default function GuideTimeline({ passos, passoAtual }) {
  const itens = useRef([])

  useEffect(() => {
    if (passoAtual < 0) return
    const timer = setTimeout(() => itens.current[passoAtual]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    return () => clearTimeout(timer)
  }, [passoAtual])

  return (
    <ol className="max-w-[720px]">
      {passos.map((passo, i) => (
        <li key={passo.titulo}>
          <TimelineItem
            ref={(el) => {
              itens.current[i] = el
            }}
            numero={i + 1}
            passo={passo}
            estado={passoAtual < 0 ? null : i === passoAtual ? 'atual' : i < passoAtual ? 'feito' : null}
            ultimo={i === passos.length - 1}
          />
        </li>
      ))}
    </ol>
  )
}

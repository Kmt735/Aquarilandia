import { useEffect, useMemo, useRef } from 'react'
import useMediaQuery from '../../hooks/useMediaQuery'
import useReducedMotion from '../../hooks/useReducedMotion'
import { MAXIMO_PEIXES, criarCena } from '../../lib/cenaAquario'

// Peixes e bolhas nadando atrás do conteúdo, num canvas decorativo (aria-hidden, sem eventos de ponteiro).
// Preenche o pai, que precisa ser `relative overflow-hidden`; o conteúdo vai por cima com `relative`.

// `de`/`ate` = trecho horizontal em % da área; `celular` = raia que continua nas telas pequenas
const RAIAS_PADRAO = [
  { top: '12%', de: 0, ate: 100, celular: true },
  { bottom: '12%', de: 0, ate: 100, celular: true },
  { top: '30%', de: 0, ate: 100 },
  { bottom: '30%', de: 0, ate: 100 },
  { top: '50%', de: 0, ate: 100 },
]

export default function AquariumBackground({
  peixes = 4,
  bolhas = 14,
  peixesCelular = 2,
  bolhasCelular = 6,
  raias = RAIAS_PADRAO,
  interativo = true,
  className = '',
}) {
  const reduzido = useReducedMotion()
  const largo = useMediaQuery('(min-width: 640px)')
  const tela = useRef(null)

  const raiasVisiveis = useMemo(() => (largo ? raias : raias.filter((r) => r.celular)), [largo, raias])
  const qtdPeixes = Math.min(largo ? peixes : peixesCelular, MAXIMO_PEIXES, raiasVisiveis.length)
  const qtdBolhas = largo ? bolhas : bolhasCelular

  useEffect(
    () => criarCena(tela.current, { peixes: qtdPeixes, bolhas: qtdBolhas, raias: raiasVisiveis, animado: !reduzido, interativo, celular: !largo }),
    [qtdPeixes, qtdBolhas, raiasVisiveis, reduzido, interativo, largo],
  )

  return <canvas ref={tela} aria-hidden="true" className={`pointer-events-none absolute inset-0 size-full ${className}`} />
}

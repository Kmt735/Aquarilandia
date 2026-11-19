import { useCallback, useEffect } from 'react'
import { useLocation } from 'react-router'
import GuideStep from '../components/molecules/GuideStep'
import Faq from '../components/organisms/Faq'
import Glossario from '../components/organisms/Glossario'
import GuiaConteudo from '../components/organisms/GuiaConteudo'
import GuiaResumo from '../components/organisms/GuiaResumo'
import ProblemasComuns from '../components/organisms/ProblemasComuns'
import SpecialistCta from '../components/organisms/SpecialistCta'
import StepNav from '../components/organisms/StepNav'
import { perguntasFrequentes } from '../data/faq'
import { glossarioGuia } from '../data/glossario'
import { passosGuia } from '../data/guia'
import useReducedMotion from '../hooks/useReducedMotion'
import useScrollSpy from '../hooks/useScrollSpy'
import { ROTAS } from '../utils/rotas'

const IDS = passosGuia.map((p) => p.id)

// Depois do último passo vem o resumo
const proximoDe = (i) =>
  i < passosGuia.length - 1 ? { id: passosGuia[i + 1].id, rotulo: `Próximo passo: ${passosGuia[i + 1].titulo}` } : { id: 'resumo', rotulo: 'Ver o resumo' }

// Aba "Aprender" da página Meu Primeiro Aquário: os 5 passos do guia, com navegação que acompanha a rolagem,
// "Entendi" salvo no navegador (vem da página, que mostra o progresso na aba), glossário e perguntas.
export default function GuiaAprender({ entendidos, onEntendi }) {
  const { hash, key } = useLocation()
  const reduzido = useReducedMotion()
  const ativo = useScrollSpy(IDS)

  // A URL acompanha a rolagem sem criar histórico: voltar sai da página, não refaz a rolagem
  // (só na aba Aprender: ao trocar para "Montar o meu", a âncora do guia não vai junto)
  useEffect(() => {
    if (ativo && window.location.pathname === ROTAS.primeiroAquario) window.history.replaceState(window.history.state, '', `#${ativo}`)
  }, [ativo])

  const irPara = useCallback(
    (id, { suave = !reduzido } = {}) => {
      const secao = document.getElementById(id)
      if (!secao) return
      secao.scrollIntoView({ behavior: suave ? 'smooth' : 'instant' })
      ;(secao.querySelector('h2[tabindex]') ?? secao).focus({ preventScroll: true })
      window.history.replaceState(window.history.state, '', `#${id}`)
    },
    [reduzido],
  )

  // Link direto (/meu-primeiro-aquario#ciclagem, vindo do montador ou de outra página): vai à seção e põe o foco no título
  useEffect(() => {
    if (hash && hash !== '#abas') irPara(hash.slice(1), { suave: false })
  }, [hash, key, irPara])

  return (
    <>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 desk:grid desk:grid-cols-[230px_minmax(0,1fr)] desk:gap-12 desk:px-10">
        <StepNav passos={passosGuia} ativo={ativo} entendidos={entendidos} onIr={irPara} />
        <div className="min-w-0">
          {passosGuia.map((passo, i) => (
            <GuideStep
              key={passo.id}
              passo={passo}
              numero={i + 1}
              total={passosGuia.length}
              anterior={passosGuia[i - 1]}
              proximo={proximoDe(i)}
              entendido={entendidos.includes(passo.id)}
              onEntendi={onEntendi}
              onIr={irPara}
            >
              <GuiaConteudo id={passo.id} />
            </GuideStep>
          ))}
        </div>
      </div>
      <GuiaResumo passos={passosGuia} />
      <Glossario ids={glossarioGuia} />
      <ProblemasComuns />
      <Faq perguntas={perguntasFrequentes} link={{ to: ROTAS.perguntas, rotulo: 'Entrega, trocas e pagamento' }} />
      <SpecialistCta />
    </>
  )
}

<<<<<<< Updated upstream
import { useState } from 'react'
import { useLocation } from 'react-router'
import Faq from '../components/organisms/Faq'
import GuideBar from '../components/organisms/GuideBar'
import GuideHero from '../components/organisms/GuideHero'
import GuideTimeline from '../components/organisms/GuideTimeline'
import SpecialistCta from '../components/organisms/SpecialistCta'
=======
import { BookOpen, Play } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { useLocation } from 'react-router'
import Button from '../components/atoms/Button'
import GuideStep from '../components/molecules/GuideStep'
import IlustracaoAquario from '../components/molecules/IlustracaoAquario'
import Faq from '../components/organisms/Faq'
import Glossario from '../components/organisms/Glossario'
import GuiaConteudo from '../components/organisms/GuiaConteudo'
import GuiaResumo from '../components/organisms/GuiaResumo'
import ProblemasComuns from '../components/organisms/ProblemasComuns'
import SpecialistCta from '../components/organisms/SpecialistCta'
import StepNav from '../components/organisms/StepNav'
import PageTemplate from '../components/templates/PageTemplate'
>>>>>>> Stashed changes
import { perguntasFrequentes } from '../data/faq'
import { passosGuia } from '../data/guia'
<<<<<<< Updated upstream
import useToast from '../hooks/useToast'
import useWhatsApp from '../hooks/useWhatsApp'

export default function PrimeiroAquarioPage() {
  const { state } = useLocation()
  const [passo, setPasso] = useState(state?.iniciarGuia ? 0 : -1) // -1 = guia desligado
  const { toast } = useToast()
  const abrirWhatsApp = useWhatsApp()

  const encerrar = (concluido) => {
    setPasso(-1)
    if (concluido) {
      toast('🎉 Guia concluído! Quer ajuda pra montar o seu?', {
        acao: 'Falar no WhatsApp',
        onAcao: () => abrirWhatsApp('montar meu primeiro aquário'),
        duracao: 6000,
      })
    }
  }
=======
import useProgressoGuia from '../hooks/useProgressoGuia'
import useReducedMotion from '../hooks/useReducedMotion'
import useScrollSpy from '../hooks/useScrollSpy'
import { ROTAS } from '../utils/rotas'

const IDS = passosGuia.map((p) => p.id)

// Depois do último passo vem o resumo
const proximoDe = (i) =>
  i < passosGuia.length - 1 ? { id: passosGuia[i + 1].id, rotulo: `Próximo passo: ${passosGuia[i + 1].titulo}` } : { id: 'resumo', rotulo: 'Ver o resumo' }

export default function PrimeiroAquarioPage() {
  const { hash } = useLocation()
  const reduzido = useReducedMotion()
  const ativo = useScrollSpy(IDS)
  const [entendidos, alternarEntendido] = useProgressoGuia()

  // A URL acompanha a rolagem sem criar histórico: voltar sai da página, não refaz a rolagem
  useEffect(() => {
    if (ativo) window.history.replaceState(window.history.state, '', `#${ativo}`)
  }, [ativo])

  // Link direto (/meu-primeiro-aquario#ciclagem): o MainLayout deixa essa rolagem para a página
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
  }, [hash])

  const irPara = useCallback(
    (id) => {
      const secao = document.getElementById(id)
      if (!secao) return
      secao.scrollIntoView({ behavior: reduzido ? 'instant' : 'smooth' })
      ;(secao.querySelector('h2[tabindex]') ?? secao).focus({ preventScroll: true })
      window.history.replaceState(window.history.state, '', `#${id}`)
    },
    [reduzido],
  )
>>>>>>> Stashed changes

  const ultimo = passo === passosGuia.length - 1

  return (
<<<<<<< Updated upstream
    <>
      <GuideHero onIniciar={() => setPasso(0)} />
      <GuideTimeline passos={passosGuia} passoAtual={passo} />
      {passo >= 0 && (
        <GuideBar
          passo={passo}
          total={passosGuia.length}
          titulo={passosGuia[passo].titulo}
          onVoltar={() => setPasso((p) => Math.max(0, p - 1))}
          onAvancar={() => (ultimo ? encerrar(true) : setPasso((p) => p + 1))}
          onSair={() => encerrar(false)}
        />
      )}
      <Faq perguntas={perguntasFrequentes} />
=======
    <PageTemplate
      eyebrow="Área educativa"
      titulo="Meu Primeiro Aquário"
      descricao="Do zero ao primeiro peixe, passo a passo."
      metaDescricao="Guia para iniciantes: equipamentos, ciclagem, qualidade da água, escolha dos peixes e manutenção, em 5 passos simples e com as palavras difíceis explicadas."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Meu Primeiro Aquário' }]}
      ilustracao={<IlustracaoAquario className="w-64 shrink-0 max-desk:hidden" />}
      cabecalhoExtra={
        <div className="mt-6 flex flex-wrap gap-3">
          <Button tamanho="lg" asChild>
            <a
              href={`#${IDS[0]}`}
              onClick={(e) => {
                e.preventDefault()
                irPara(IDS[0])
              }}
            >
              <Play aria-hidden="true" />
              Começar pelo passo 1
            </a>
          </Button>
          <Button tamanho="lg" variant="secundario" asChild>
            <a href="#glossario">
              <BookOpen aria-hidden="true" />
              Ver glossário
            </a>
          </Button>
        </div>
      }
    >
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
              onEntendi={alternarEntendido}
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
>>>>>>> Stashed changes
      <SpecialistCta />
    </>
  )
}

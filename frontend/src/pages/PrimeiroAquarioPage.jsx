import { useState } from 'react'
import { useLocation } from 'react-router'
import Faq from '../components/organisms/Faq'
import GuideBar from '../components/organisms/GuideBar'
import GuideHero from '../components/organisms/GuideHero'
import GuideTimeline from '../components/organisms/GuideTimeline'
import SpecialistCta from '../components/organisms/SpecialistCta'
import { perguntasFrequentes } from '../data/faq'
import { passosGuia } from '../data/guia'
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

  const ultimo = passo === passosGuia.length - 1

  return (
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
      <SpecialistCta />
    </>
  )
}

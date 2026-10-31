import { BookOpen, Play } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import Button from '../components/atoms/Button'
import Faq from '../components/organisms/Faq'
import Glossario from '../components/organisms/Glossario'
import GuideBar from '../components/organisms/GuideBar'
import GuideTimeline from '../components/organisms/GuideTimeline'
import ProblemasComuns from '../components/organisms/ProblemasComuns'
import SpecialistCta from '../components/organisms/SpecialistCta'
import PageTemplate from '../components/templates/PageTemplate'
import { perguntasFrequentes } from '../data/faq'
import { glossarioGuia } from '../data/glossario'
import { passosGuia } from '../data/guia'
import useToast from '../hooks/useToast'
import { ROTAS } from '../utils/rotas'

// Termo do glossário ligado a cada etapa (sem mudar o formato de data/guia.js)
const TERMO_DO_PASSO = { 'Prepare substrato e decoração': 'substrato', 'Faça a ciclagem': 'ciclagem', 'Teste a água': 'amonia' }

export default function PrimeiroAquarioPage() {
  const { state } = useLocation()
  const [passo, setPasso] = useState(state?.iniciarGuia ? 0 : -1) // -1 = guia desligado
  const { toast } = useToast()
  const passos = passosGuia.map((p) => ({ ...p, termo: TERMO_DO_PASSO[p.titulo] }))
  const ultimo = passo === passos.length - 1

  const encerrar = (concluido) => {
    setPasso(-1)
    if (concluido) toast('Guia concluído! Quando quiser, a loja pode montar o seu.', { tipo: 'sucesso' })
  }

  return (
    <PageTemplate
      eyebrow="Área educativa"
      titulo="Meu Primeiro Aquário"
      descricao={`${passos.length} etapas simples para sair do zero até um aquário saudável, com as palavras difíceis explicadas.`}
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Meu Primeiro Aquário' }]}
      cabecalhoExtra={
        <div className="mt-6 flex flex-wrap gap-3">
          <Button tamanho="lg" onClick={() => setPasso(0)}>
            <Play aria-hidden="true" />
            {passo >= 0 ? 'Recomeçar o guia' : 'Iniciar o guia passo a passo'}
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
      <section aria-labelledby="titulo-etapas" className="mx-auto max-w-[1200px] px-4 pt-12 pb-6 sm:px-6 desk:px-10">
        <h2 id="titulo-etapas" className="mb-8 text-h2">
          As {passos.length} etapas
        </h2>
        <GuideTimeline passos={passos} passoAtual={passo} />
      </section>
      {passo >= 0 && (
        <GuideBar
          passo={passo}
          total={passos.length}
          titulo={passos[passo].titulo}
          onVoltar={() => setPasso((p) => Math.max(0, p - 1))}
          onAvancar={() => (ultimo ? encerrar(true) : setPasso((p) => p + 1))}
          onSair={() => encerrar(false)}
        />
      )}
      <Glossario ids={glossarioGuia} />
      <ProblemasComuns />
      <Faq perguntas={perguntasFrequentes} link={{ to: ROTAS.perguntas, rotulo: 'Entrega, trocas e pagamento' }} />
      <SpecialistCta />
    </PageTemplate>
  )
}

import { BookOpen, ListChecks, Play } from 'lucide-react'
import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import Button from '../components/atoms/Button'
import { CardItemSkeleton } from '../components/molecules/CardItem'
import IlustracaoAquario from '../components/molecules/IlustracaoAquario'
import PageTemplate from '../components/templates/PageTemplate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { etapasMontagem } from '../data/montagem'
import { passosGuia } from '../data/guia'
import useMontagem from '../hooks/useMontagem'
import useProgressoGuia from '../hooks/useProgressoGuia'
import useReducedMotion from '../hooks/useReducedMotion'
import { ROTAS } from '../utils/rotas'
import GuiaAprender from './GuiaAprender'

// O montador (e o catálogo que ele consulta) só carrega quando a aba "Montar o meu" abre
const MontadorAquario = lazy(() => import('./MontadorAquario'))

const ABAS = {
  aprender: {
    caminho: ROTAS.primeiroAquario,
    documento: 'Meu Primeiro Aquário',
    meta: 'Guia para iniciantes: equipamentos, ciclagem, qualidade da água, escolha dos peixes e manutenção, em 5 passos simples, e um montador para escolher os itens do seu aquário com preço estimado.',
  },
  montar: {
    caminho: ROTAS.montarAquario,
    documento: 'Montar o meu aquário · Meu Primeiro Aquário',
    meta: 'Monte seu primeiro aquário passo a passo: escolha aquário, filtro, aquecedor, substrato, plantas e peixes, veja o preço estimado e os avisos de compatibilidade.',
  },
}
const ALTURA_ABAS = '3.5rem'

// Meu Primeiro Aquário (nome do item 10 do PDF): uma página, duas abas com endereço próprio.
// - Aprender (/meu-primeiro-aquario): o guia em 5 passos.
// - Montar o meu (/meu-primeiro-aquario/montar): o montador em 6 etapas. /monte-seu-aquario redireciona para cá.
// O progresso das duas fica salvo no navegador e aparece na própria aba.
export default function PrimeiroAquarioPage() {
  const { aba: segmento } = useParams()
  const navigate = useNavigate()
  const reduzido = useReducedMotion()
  const aba = segmento === 'montar' ? 'montar' : 'aprender'
  const [entendidos, alternarEntendido] = useProgressoGuia()
  const montagemApi = useMontagem()
  const refAncora = useRef(null)

  const lidos = passosGuia.filter((p) => entendidos.includes(p.id)).length
  const etapasFeitas = etapasMontagem.filter((e) => montagemApi.montagem.concluidas.includes(e.id)).length

  // As abas ficam presas no topo: a rolagem por âncora e as navegações fixas descontam a altura delas.
  // useLayoutEffect: precisa valer ANTES do efeito do guia que rola até a âncora (#ciclagem)
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--altura-abas', ALTURA_ABAS)
    return () => document.documentElement.style.removeProperty('--altura-abas')
  }, [])

  const trocar = (valor) => {
    // Sem voltar ao topo da página: se as abas já estavam presas, a nova aba começa logo abaixo delas
    navigate(ABAS[valor].caminho, { state: { manterRolagem: true } })
    const ancora = refAncora.current
    if (ancora && ancora.getBoundingClientRect().top < 0) ancora.scrollIntoView({ behavior: reduzido ? 'instant' : 'smooth' })
  }

  const classeAba =
    'h-full min-h-11 flex-1 border-b-[3px] border-transparent px-3 text-pequeno font-semibold text-text-muted hover:text-primary-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-text data-[state=active]:border-primary-text data-[state=active]:font-bold data-[state=active]:text-primary-text sm:flex-none sm:px-5'
  const contador = 'rounded-full bg-surface-muted px-2 py-0.5 text-micro font-bold tabular-nums text-text-muted'

  // /meu-primeiro-aquario/qualquer-coisa: volta para a aba Aprender
  if (segmento && segmento !== 'montar') return <Navigate to={ROTAS.primeiroAquario} replace />

  return (
    <PageTemplate
      eyebrow="Área educativa"
      titulo="Meu Primeiro Aquário"
      tituloDocumento={ABAS[aba].documento}
      descricao="Aprenda do zero ao primeiro peixe e monte o seu aquário, passo a passo."
      metaDescricao={ABAS[aba].meta}
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Meu Primeiro Aquário', to: aba === 'montar' ? ROTAS.primeiroAquario : undefined }, ...(aba === 'montar' ? [{ rotulo: 'Montar o meu' }] : [])]}
      ilustracao={<IlustracaoAquario className="w-64 shrink-0 max-desk:hidden" />}
      cabecalhoExtra={
        <div className="mt-6 flex flex-wrap gap-3">
          <Button tamanho="lg" asChild>
            <Link to={`${ROTAS.primeiroAquario}#${passosGuia[0].id}`}>
              <Play aria-hidden="true" />
              Começar pelo passo 1
            </Link>
          </Button>
          <Button tamanho="lg" variant="secundario" asChild>
            <Link to={ROTAS.montarAquario} state={{ manterRolagem: true }}>
              <ListChecks aria-hidden="true" />
              Montar o meu aquário
            </Link>
          </Button>
          <Button tamanho="lg" variant="terciario" asChild>
            <Link to={`${ROTAS.primeiroAquario}#glossario`}>
              <BookOpen aria-hidden="true" />
              Ver glossário
            </Link>
          </Button>
        </div>
      }
    >
      <div id="abas" ref={refAncora} className="scroll-mt-16 desk:scroll-mt-[72px]" />
      <Tabs value={aba} onValueChange={trocar}>
        <div className="sticky top-16 z-30 border-b border-border bg-surface/95 backdrop-blur desk:top-[72px]">
          <TabsList aria-label="Meu Primeiro Aquário" className="mx-auto flex h-14 w-full max-w-[1200px] gap-1 px-4 sm:px-6 desk:px-10">
            <TabsTrigger value="aprender" className={classeAba}>
              <BookOpen aria-hidden="true" className="size-4" />
              Aprender
              <span className={contador} aria-hidden="true">
                {lidos}/{passosGuia.length}
              </span>
              <span className="sr-only">, {lidos} de {passosGuia.length} passos lidos</span>
            </TabsTrigger>
            <TabsTrigger value="montar" className={classeAba}>
              <ListChecks aria-hidden="true" className="size-4" />
              Montar o meu
              <span className={contador} aria-hidden="true">
                {etapasFeitas}/{etapasMontagem.length}
              </span>
              <span className="sr-only">, {etapasFeitas} de {etapasMontagem.length} etapas feitas</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="aprender" tabIndex={-1}>
          <GuiaAprender entendidos={entendidos} onEntendi={alternarEntendido} />
        </TabsContent>
        <TabsContent value="montar" tabIndex={-1}>
          <Suspense
            fallback={
              <div aria-busy="true" className="mx-auto grid max-w-[1200px] gap-4 px-4 pt-8 sm:grid-cols-2 sm:px-6 desk:px-10 xl:grid-cols-3">
                <p className="sr-only">Carregando o montador…</p>
                {[0, 1, 2].map((i) => <CardItemSkeleton key={i} />)}
              </div>
            }
          >
            <MontadorAquario montagemApi={montagemApi} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageTemplate>
  )
}

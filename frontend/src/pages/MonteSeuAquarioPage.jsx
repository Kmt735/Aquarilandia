import { ListChecks, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Button from '../components/atoms/Button'
import Preco from '../components/atoms/Preco'
import { SeloNivel } from '../components/molecules/CompatibilityWarning'
import { CardItemSkeleton } from '../components/molecules/CardItem'
import EmptyState from '../components/molecules/EmptyState'
import IlustracaoAquario from '../components/molecules/IlustracaoAquario'
import BuilderStep from '../components/organisms/BuilderStep'
import BuilderStepper from '../components/organisms/BuilderStepper'
import BuilderSummary from '../components/organisms/BuilderSummary'
import { EtapaAquario, EtapaDecoracao, EtapaEquipamentos, EtapaPeixes, EtapaPlantas, EtapaSubstrato } from '../components/organisms/BuilderEtapas'
import PageTemplate from '../components/templates/PageTemplate'
import { etapasMontagem, rotulosEtapas } from '../data/montagem'
import useCart from '../hooks/useCart'
import useConsulta from '../hooks/useConsulta'
import useMontagem from '../hooks/useMontagem'
import useReducedMotion from '../hooks/useReducedMotion'
import useToast from '../hooks/useToast'
import useUI from '../hooks/useUI'
import useWhatsApp from '../hooks/useWhatsApp'
import { aquarioDaMontagem, avisosDaMontagem, ETAPAS, linhasDaMontagem, mensagemWhatsApp, totaisDaMontagem } from '../lib/montagem'
import { carregarCatalogoMontagem } from '../services/montagem'
import { formatarPreco, plural } from '../utils/format'
import { ROTAS } from '../utils/rotas'

const CONTEUDO = { aquario: EtapaAquario, equipamentos: EtapaEquipamentos, substrato: EtapaSubstrato, decoracao: EtapaDecoracao, plantas: EtapaPlantas, peixes: EtapaPeixes }
const nomes = (lista) => lista.map((x) => x.item.nome).join(', ')

// Texto do resultado de "Adicionar ao carrinho" (o que entrou, o que foi limitado e o que ficou de fora)
function textoResultado({ adicionados, limitados, ignorados }) {
  const unidades = adicionados.reduce((s, a) => s + a.qtd, 0)
  const partes = [unidades ? `${plural(unidades, 'item', 'itens')} ${unidades === 1 ? 'adicionado' : 'adicionados'} ao carrinho.` : 'Nenhum item foi adicionado ao carrinho.']
  if (limitados.length) {
    partes.push(`Ajustamos a quantidade de ${limitados.map((l) => `${l.item.nome} (${l.adicionado} de ${l.pedido}${l.motivo === 'estoque' ? ', o que temos em estoque' : ', limite de 99 por produto'})`).join('; ')}.`)
  }
  const esgotados = ignorados.filter((i) => i.motivo === 'esgotado')
  const noMaximo = ignorados.filter((i) => i.motivo === 'estoque' || i.motivo === 'limite')
  if (esgotados.length) partes.push(`Ficaram de fora por estarem esgotados: ${nomes(esgotados)}.`)
  if (noMaximo.length) partes.push(`Já estavam no carrinho na quantidade máxima: ${nomes(noMaximo)}.`)
  return { texto: partes.join(' '), problema: limitados.length + ignorados.length > 0, nada: unidades === 0 }
}

export default function MonteSeuAquarioPage() {
  const consulta = useConsulta(carregarCatalogoMontagem, [])
  const { montagem, irPara, avancar, concluirUltima, escolherAquario, usarAquarioProprio, alternar, definirQtd, remover, recomecar } = useMontagem()
  const { adicionarVarios } = useCart()
  const { toast } = useToast()
  const { abrirPainel } = useUI()
  const abrirWhatsApp = useWhatsApp()
  const reduzido = useReducedMotion()
  const [lista, setLista] = useState(false) // gaveta da lista no celular
  const [confirmar, setConfirmar] = useState(null) // 'incompativel' | 'recomecar' | null
  const [resultadoCarrinho, setResultadoCarrinho] = useState(null)
  const refTitulo = useRef(null)
  const refTopo = useRef(null)
  const primeira = useRef(true)

  const catalogo = consulta.dados
  const porId = useMemo(() => new Map(Object.values(catalogo ?? {}).flat().map((i) => [i.id, i])), [catalogo])
  const aquario = aquarioDaMontagem(montagem, porId)
  const linhas = linhasDaMontagem(montagem, porId)
  const totais = totaisDaMontagem(linhas)
  const avisos = avisosDaMontagem(aquario, linhas)
  const incompativeis = avisos.filter((a) => a.nivel === 'incompativel')
  const qtdItens = ETAPAS.reduce((s, e) => s + linhas[e].reduce((t, l) => t + l.qtd, 0), 0)
  const etapa = etapasMontagem[montagem.etapa]
  const ultima = montagem.etapa === etapasMontagem.length - 1

  // Ao trocar de etapa: volta ao topo do montador e põe o foco no título da etapa
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    refTopo.current?.scrollIntoView({ behavior: reduzido ? 'instant' : 'smooth', block: 'start' })
    refTitulo.current?.focus({ preventScroll: true })
  }, [montagem.etapa, reduzido])

  // A mensagem do último "Adicionar ao carrinho" só vale enquanto as escolhas não mudarem
  const escolhasChave = JSON.stringify(montagem.escolhas)
  const resultadoAtual = resultadoCarrinho?.chave === escolhasChave ? resultadoCarrinho : null

  const irParaEtapa = (i) => {
    setLista(false)
    if (i >= 0) irPara(i)
  }

  const adicionarTudo = () => {
    setConfirmar(null)
    const r = adicionarVarios(ETAPAS.flatMap((e) => linhas[e]).map((l) => ({ item: l.item, qtd: l.qtd })))
    if (r.bloqueado) {
      toast('Seu carrinho salvo está num formato desconhecido. Limpe o carrinho e tente de novo.', { tipo: 'erro', acao: 'Ver carrinho', onAcao: () => abrirPainel('carrinho') })
      return
    }
    const { texto, problema, nada } = textoResultado(r)
    setResultadoCarrinho({ tipo: nada ? 'erro' : problema ? 'aviso' : 'sucesso', texto, chave: escolhasChave })
    toast(texto, { tipo: nada ? 'erro' : problema ? 'info' : 'sucesso', acao: nada ? undefined : 'Ver carrinho', onAcao: () => { setLista(false); abrirPainel('carrinho') } })
  }

  const pedirAdicao = () => (incompativeis.length ? setConfirmar('incompativel') : adicionarTudo())
  const pedirOrientacao = () => abrirWhatsApp(null, mensagemWhatsApp({ aquario, linhas, totais, avisos, rotulos: rotulosEtapas }))

  const proximo = () => {
    if (!ultima) return avancar()
    concluirUltima()
    // Última etapa: leva à lista (lateral no desktop, gaveta no celular)
    if (window.matchMedia('(min-width: 900px)').matches) document.getElementById('resumo-desktop')?.focus()
    else setLista(true)
  }

  const ctx = { catalogo, montagem, aquario, linhas, avisos, irPara: irParaEtapa, escolherAquario, usarAquarioProprio, alternar, definirQtd, remover }
  const Conteudo = CONTEUDO[etapa.id]
  const resumo = {
    etapas: etapasMontagem, aquario, linhas, totais, avisos, resultadoCarrinho: resultadoAtual,
    onIrEtapa: irParaEtapa, onQtd: definirQtd, onRemover: remover, onTirarAquarioProprio: () => usarAquarioProprio(null),
    onAdicionar: pedirAdicao, onOrientacao: pedirOrientacao, onRecomecar: () => setConfirmar('recomecar'),
  }

  return (
    <PageTemplate
      eyebrow="Passo a passo"
      titulo="Monte seu aquário"
      descricao="Escolha o aquário, os equipamentos, o substrato, a decoração, as plantas e os peixes. Mostramos o preço estimado e avisamos se algo não combinar."
      metaDescricao="Monte seu aquário passo a passo: escolha aquário, filtro, aquecedor, substrato, plantas e peixes, veja o preço estimado e os avisos de compatibilidade."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Monte seu aquário' }]}
      ilustracao={<IlustracaoAquario className="w-56 shrink-0 max-desk:hidden" />}
    >
      <div ref={refTopo} className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-8 pb-32 sm:px-6 desk:px-10 desk:pb-16">
        {/* Anúncio para leitores de tela quando o total ou os avisos mudam */}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {catalogo && `Total estimado: ${formatarPreco(totais.total, { centavos: true })}. ${avisos.length ? `${plural(avisos.length, 'aviso')}, ${plural(incompativeis.length, 'incompatível', 'incompatíveis')}.` : 'Nenhum aviso.'}`}
        </p>

        <BuilderStepper etapas={etapasMontagem} atual={montagem.etapa} concluidas={montagem.concluidas} onIr={irParaEtapa} />

        <div className="mt-8 desk:grid desk:grid-cols-[minmax(0,1fr)_360px] desk:items-start desk:gap-10">
          <div className="min-w-0">
            {consulta.erro ? (
              <EmptyState tom="erro" titulo="Não conseguimos carregar os produtos" acoes={<Button onClick={consulta.recarregar}>Tentar de novo</Button>}>
                Suas escolhas continuam salvas. Tente de novo em instantes.
              </EmptyState>
            ) : consulta.carregando ? (
              <div aria-busy="true">
                <p className="sr-only">Carregando os produtos…</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <CardItemSkeleton key={i} />)}</div>
              </div>
            ) : (
              <BuilderStep
                key={etapa.id} ref={refTitulo} etapa={etapa} indice={montagem.etapa} total={etapasMontagem.length}
                onVoltar={() => irPara(montagem.etapa - 1)} onProximo={proximo} onPular={avancar}
                rotuloProximo={ultima ? 'Revisar a lista' : undefined}
              >
                <Conteudo ctx={ctx} />
              </BuilderStep>
            )}
          </div>

          <aside aria-label="Resumo da montagem" className="max-desk:hidden desk:sticky desk:top-24">
            <div id="resumo-desktop" tabIndex={-1} className="max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-card border border-border-strong bg-surface p-5 shadow-soft outline-none focus-visible:shadow-glow">
              <BuilderSummary {...resumo} idTitulo="resumo-desktop-titulo" />
            </div>
          </aside>
        </div>
      </div>

      {/* Celular/tablet: barra fixa com o total e a lista numa gaveta de baixo */}
      <div className="fixed inset-x-0 bottom-0 z-(--z-flutuante) border-t border-border-strong bg-surface/95 px-4 py-3 shadow-pop backdrop-blur desk:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-legenda text-text-muted">Total estimado</p>
            <Preco valor={totais.total} centavos tamanho="sm" />
            {avisos.length > 0 && (
              <SeloNivel nivel={incompativeis.length ? 'incompativel' : 'atencao'} className="ml-2 normal-case">
                {plural(avisos.length, 'aviso')}
              </SeloNivel>
            )}
          </div>
          <Button onClick={() => setLista(true)} aria-haspopup="dialog" aria-expanded={lista}>
            <ListChecks aria-hidden="true" />
            Ver lista{qtdItens ? ` (${qtdItens})` : ''}
          </Button>
        </div>
      </div>
      <Sheet open={lista} onOpenChange={setLista}>
        <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-faixa border-border-strong bg-surface px-4 pt-6 pb-8 sm:px-6">
          <SheetHeader className="sr-only">
            <SheetTitle>Lista da montagem</SheetTitle>
            <SheetDescription>Itens escolhidos, avisos e preço estimado.</SheetDescription>
          </SheetHeader>
          <BuilderSummary {...resumo} idTitulo="resumo-celular-titulo" />
        </SheetContent>
      </Sheet>

      <Dialog open={confirmar === 'incompativel'} onOpenChange={(aberto) => !aberto && setConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Há itens incompatíveis na montagem</DialogTitle>
            <DialogDescription>Você pode adicionar mesmo assim, mas recomendamos revisar antes:</DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto text-pequeno">
            {incompativeis.map((a) => (
              <li key={a.id} className="rounded-lg bg-danger-soft px-3 py-2">
                <SeloNivel nivel="incompativel" />
                <p className="font-bold">{a.titulo}</p>
                <p className="text-text-muted">{a.solucao}</p>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="secundario" onClick={() => setConfirmar(null)}>Revisar</Button>
            <Button onClick={adicionarTudo}>Adicionar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmar === 'recomecar'} onOpenChange={(aberto) => !aberto && setConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Começar de novo?</DialogTitle>
            <DialogDescription>Todas as escolhas desta montagem serão apagadas. O seu carrinho não muda.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secundario" onClick={() => setConfirmar(null)}>Cancelar</Button>
            <Button variant="perigo" onClick={() => { recomecar(); setConfirmar(null); setLista(false) }}>
              <RotateCcw aria-hidden="true" />
              Apagar e recomeçar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTemplate>
  )
}

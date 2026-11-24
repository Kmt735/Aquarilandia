import { MessageSquareHeart, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../components/atoms/Button'
import EstrelasExibicao from '../components/atoms/EstrelasExibicao'
import Skeleton from '../components/atoms/Skeleton'
import Aviso from '../components/molecules/Aviso'
import BarraDistribuicao from '../components/molecules/BarraDistribuicao'
import EmptyState from '../components/molecules/EmptyState'
import PageTemplate from '../components/templates/PageTemplate'
import { ENCONTROU, MOTIVOS_VISITA, ROTULO_NOTA } from '../data/avaliacao-site'
import useUI from '../hooks/useUI'
import { buscarResumoAvaliacoes } from '../services/avaliacoes'
import { ROTAS } from '../utils/rotas'

const rotuloDe = (opcoes, v) => opcoes.find(([valor]) => valor === v)?.[1]
const ORIGEM = { aba: 'Aba lateral', rodape: 'Rodapé', 'pos-compra': 'Depois da compra' }
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Página escondida (fora do menu e do rodapé) para mostrar as respostas na apresentação.
// Mostra o resumo das avaliações APROVADAS pela loja (GET /api/avaliacoes-site). As novas e a moderação ficam
// no painel do administrador (Admin → Avaliações).
export default function AvaliacoesSitePage() {
  const [resumo, setResumo] = useState(null)
  const [erro, setErro] = useState(null)
  const [versao, setVersao] = useState(0)
  const { painel, abrirAvaliacao } = useUI()

  // Recarrega ao abrir a página e sempre que o painel de avaliação fecha
  useEffect(() => {
    if (painel === 'avaliacao') return
    let ativo = true
    buscarResumoAvaliacoes()
      .then((r) => { if (ativo) { setResumo(r); setErro(null) } })
      .catch((e) => { if (ativo) setErro(e) })
    return () => {
      ativo = false
    }
  }, [painel, versao])

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  return (
    <PageTemplate
      eyebrow="Uso interno"
      titulo="Avaliações do site"
      descricao="O que os visitantes acharam de navegar pelo site. Não são avaliações de produtos."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Avaliações do site' }]}
    >
      <div className="mx-auto max-w-[1000px] space-y-8 px-4 py-10 sm:px-6">
        <Aviso tipo="info" titulo="Só avaliações aprovadas">
          Cada avaliação nova passa pela loja antes de aparecer aqui. As que ainda esperam conferência ficam no painel do administrador, em Avaliações.
        </Aviso>

        {erro && !resumo ? (
          <Aviso tipo="erro" role="alert" acao={<Button variant="secundario" onClick={() => setVersao((v) => v + 1)}>Tentar de novo</Button>}>
            Não conseguimos carregar as avaliações agora.
          </Aviso>
        ) : resumo === null ? (
          <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
            <span className="sr-only">Carregando avaliações…</span>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : resumo.total === 0 ? (
          <EmptyState
            icone={<MessageSquareHeart aria-hidden="true" />}
            titulo="Nenhuma avaliação ainda"
            acoes={<Button onClick={() => abrirAvaliacao('aba')}>Fazer uma avaliação de teste</Button>}
          >
            Quando alguém usar o botão “Avalie o site” e a loja aprovar, as respostas aparecem aqui.
          </EmptyState>
        ) : (
          <Resumo r={resumo} />
        )}
      </div>
    </PageTemplate>
  )
}

function Resumo({ r }) {
  const cartao = 'rounded-xl border border-border-strong bg-surface p-5'

  return (
    <>
      <section aria-labelledby="av-visao" className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <h2 id="av-visao" className="sr-only">Visão geral</h2>
        <div className={`${cartao} flex flex-col justify-center gap-3`}>
          <div>
            <p className="text-pequeno font-semibold text-text-muted">Nota média</p>
            <p className="font-display text-h1 font-extrabold text-foreground tabular-nums">
              {numero.format(r.media)}
              <span className="text-h4 text-text-muted"> de 5</span>
            </p>
            <EstrelasExibicao nota={r.media} />
          </div>
          <p className="text-pequeno text-text-muted">
            <strong className="text-foreground tabular-nums">{r.total}</strong> {r.total === 1 ? 'avaliação' : 'avaliações'}
          </p>
        </div>

        <div className={cartao}>
          <h3 className="mb-3 text-h4">Distribuição das notas</h3>
          <ul className="space-y-2">
            {r.distribuicao.map(({ nota, qtd }) => (
              <BarraDistribuicao key={nota} rotulo={`${nota} ${nota === 1 ? 'estrela' : 'estrelas'}`} dica={ROTULO_NOTA[nota]} qtd={qtd} total={r.total} />
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Respostas das outras perguntas" className="grid gap-4 sm:grid-cols-2">
        <div className={cartao}>
          <h2 className="mb-3 text-h4">O que vieram fazer</h2>
          <ul className="space-y-2">
            {r.motivos.map((m) => <BarraDistribuicao key={m.valor} rotulo={m.rotulo} qtd={m.qtd} total={r.total} />)}
          </ul>
          <SemResposta qtd={r.total - r.motivos.reduce((s, m) => s + m.qtd, 0)} />
        </div>
        <div className={cartao}>
          <h2 className="mb-3 text-h4">Encontraram o que procuravam?</h2>
          <ul className="space-y-2">
            {r.encontrou.map((m) => <BarraDistribuicao key={m.valor} rotulo={m.rotulo} qtd={m.qtd} total={r.total} />)}
          </ul>
          <SemResposta qtd={r.total - r.encontrou.reduce((s, m) => s + m.qtd, 0)} />
        </div>
      </section>

      <section aria-labelledby="av-comentarios" className={cartao}>
        <h2 id="av-comentarios" className="mb-3 text-h4">
          Comentários <span className="text-pequeno font-semibold text-text-muted">({r.comentarios.length})</span>
        </h2>
        {r.comentarios.length === 0 ? (
          <p className="text-pequeno text-text-muted">Ninguém deixou comentário ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {r.comentarios.map((a) => (
              <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                <p className="text-corpo whitespace-pre-line text-foreground">“{a.comentario}”</p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-legenda text-text-muted">
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Star aria-hidden="true" className="size-3.5 fill-accent text-warning-text" />
                    {a.nota} de 5
                  </span>
                  {a.motivo && <span>Veio para: {rotuloDe(MOTIVOS_VISITA, a.motivo)}</span>}
                  {a.encontrou && <span>Encontrou: {rotuloDe(ENCONTROU, a.encontrou)}</span>}
                  <span>{ORIGEM[a.origem] ?? a.origem}</span>
                  <time dateTime={a.criadaEm}>{data.format(new Date(a.criadaEm))}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}


function SemResposta({ qtd }) {
  if (!qtd) return null
  return <p className="mt-3 text-legenda text-text-muted">{qtd} sem resposta (pergunta opcional)</p>
}


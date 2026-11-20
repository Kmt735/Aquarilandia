import { MessageSquareHeart, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../components/atoms/Button'
import Skeleton from '../components/atoms/Skeleton'
import Aviso from '../components/molecules/Aviso'
import EmptyState from '../components/molecules/EmptyState'
import PageTemplate from '../components/templates/PageTemplate'
import { ENCONTROU, MOTIVOS_VISITA, ROTULO_NOTA } from '../data/avaliacao-site'
import useUI from '../hooks/useUI'
import { apagarAvaliacoesLocais, listarAvaliacoes, resumirAvaliacoes } from '../services/avaliacoes'
import { ROTAS } from '../utils/rotas'

const rotuloDe = (opcoes, v) => opcoes.find(([valor]) => valor === v)?.[1]
const ORIGEM = { aba: 'Aba lateral', rodape: 'Rodapé', 'pos-compra': 'Depois da compra' }
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const porcento = (qtd, total) => (total ? Math.round((qtd / total) * 100) : 0)
const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Página escondida (fora do menu e do rodapé) para mostrar as respostas na apresentação.
// Lê só o que foi salvo NESTE navegador até a integração com o backend/Google Form (services/avaliacoes.js).
export default function AvaliacoesSitePage() {
  const [lista, setLista] = useState(null)
  const { painel, abrirAvaliacao } = useUI()

  // Recarrega ao abrir a página e sempre que o painel de avaliação fecha (para ver a resposta nova na hora)
  useEffect(() => {
    if (painel === 'avaliacao') return
    let ativo = true
    listarAvaliacoes().then((l) => ativo && setLista(l))
    return () => {
      ativo = false
    }
  }, [painel])

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => meta.remove()
  }, [])

  const apagar = () => {
    if (!window.confirm('Apagar todas as avaliações salvas neste navegador? Isso não pode ser desfeito.')) return
    apagarAvaliacoesLocais()
    setLista([])
  }

  return (
    <PageTemplate
      eyebrow="Uso interno"
      titulo="Avaliações do site"
      descricao="O que os visitantes acharam de navegar pelo site. Não são avaliações de produtos."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Avaliações do site' }]}
    >
      <div className="mx-auto max-w-[1000px] space-y-8 px-4 py-10 sm:px-6">
        <Aviso tipo="aviso" titulo="Protótipo">
          As respostas ficam guardadas só neste navegador. Quando o site for ligado ao backend (ou a um Google Form), esta página passa a mostrar as respostas de todos os visitantes.
        </Aviso>

        {lista === null ? (
          <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
            <span className="sr-only">Carregando avaliações…</span>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : lista.length === 0 ? (
          <EmptyState
            icone={<MessageSquareHeart aria-hidden="true" />}
            titulo="Nenhuma avaliação ainda"
            acoes={<Button onClick={() => abrirAvaliacao('aba')}>Fazer uma avaliação de teste</Button>}
          >
            Quando alguém usar o botão “Avalie o site”, as respostas aparecem aqui.
          </EmptyState>
        ) : (
          <Resumo lista={lista} onApagar={apagar} />
        )}
      </div>
    </PageTemplate>
  )
}

function Resumo({ lista, onApagar }) {
  const r = resumirAvaliacoes(lista)
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
            <EstrelasMedia media={r.media} />
          </div>
          <p className="text-pequeno text-text-muted">
            <strong className="text-foreground tabular-nums">{r.total}</strong> {r.total === 1 ? 'avaliação' : 'avaliações'}
          </p>
        </div>

        <div className={cartao}>
          <h3 className="mb-3 text-h4">Distribuição das notas</h3>
          <ul className="space-y-2">
            {r.distribuicao.map(({ nota, qtd }) => (
              <Barra key={nota} rotulo={`${nota} ${nota === 1 ? 'estrela' : 'estrelas'}`} dica={ROTULO_NOTA[nota]} qtd={qtd} total={r.total} />
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Respostas das outras perguntas" className="grid gap-4 sm:grid-cols-2">
        <div className={cartao}>
          <h2 className="mb-3 text-h4">O que vieram fazer</h2>
          <ul className="space-y-2">
            {r.motivos.map((m) => <Barra key={m.valor} rotulo={m.rotulo} qtd={m.qtd} total={r.total} />)}
          </ul>
          <SemResposta qtd={r.total - r.motivos.reduce((s, m) => s + m.qtd, 0)} />
        </div>
        <div className={cartao}>
          <h2 className="mb-3 text-h4">Encontraram o que procuravam?</h2>
          <ul className="space-y-2">
            {r.encontrou.map((m) => <Barra key={m.valor} rotulo={m.rotulo} qtd={m.qtd} total={r.total} />)}
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
                  <span>{ORIGEM[a.origem] ?? a.origem}{a.pagina ? ` · ${a.pagina}` : ''}</span>
                  <time dateTime={a.criadaEm}>{data.format(new Date(a.criadaEm))}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <Button variant="secundario" onClick={onApagar}>
          <Trash2 aria-hidden="true" />
          Apagar respostas deste navegador
        </Button>
      </div>
    </>
  )
}

// Barra horizontal com o número escrito ao lado (a leitura não depende do tamanho da barra)
function Barra({ rotulo, dica, qtd, total }) {
  const pct = porcento(qtd, total)
  return (
    <li className="grid grid-cols-[8.5rem_1fr_4.75rem] items-center gap-3 text-pequeno sm:grid-cols-[11rem_1fr_4.75rem]">
      <span className="text-foreground">
        {rotulo}
        {dica && <span className="sr-only"> ({dica})</span>}
      </span>
      <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right text-text-muted tabular-nums">
        {qtd} <span className="text-legenda">({pct}%)</span>
      </span>
    </li>
  )
}

function SemResposta({ qtd }) {
  if (!qtd) return null
  return <p className="mt-3 text-legenda text-text-muted">{qtd} sem resposta (pergunta opcional)</p>
}

function EstrelasMedia({ media }) {
  const cheias = Math.round(media)
  return (
    <span aria-hidden="true" className="mt-1 flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} strokeWidth={1.75} className={`size-5 ${n <= cheias ? 'fill-accent text-warning-text' : 'text-border-control'}`} />
      ))}
    </span>
  )
}

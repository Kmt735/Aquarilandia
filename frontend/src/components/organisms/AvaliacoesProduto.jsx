import { CircleCheck, MessageSquareText, PenLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import Button from '../atoms/Button'
import EstrelasExibicao from '../atoms/EstrelasExibicao'
import Input from '../atoms/Input'
import Skeleton from '../atoms/Skeleton'
import Textarea from '../atoms/Textarea'
import Aviso from '../molecules/Aviso'
import BarraDistribuicao from '../molecules/BarraDistribuicao'
import EstrelasNota from '../molecules/EstrelasNota'
import { MSG_PENDENTE, MSG_PUBLICADA, ROTULO_NOTA } from '../../data/avaliacao-site'
import useAuth from '../../hooks/useAuth'
import { LIMITE_COMENTARIO_PRODUTO, LIMITE_NOME } from '../../services/avaliacoes-produto'

const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const POR_PAGINA = 5

// Seção "Avaliações" da página do produto/peixe: resumo (média + distribuição), formulário inline
// (abre no botão, divulgação progressiva) e lista das avaliações, mais recentes primeiro.
export default function AvaliacoesProduto({ nomeItem, avaliacoes }) {
  const { lista, resumo, carregando, erro, recarregar, enviar, jaAvaliou } = avaliacoes
  const [aberto, setAberto] = useState(false)
  // Status da avaliação enviada nesta visita ('pendente' ou 'aprovada'): decide o agradecimento
  const [agradecer, setAgradecer] = useState(null)
  const [mostrar, setMostrar] = useState(POR_PAGINA)
  const tituloFormRef = useRef(null)
  const botaoRef = useRef(null)
  const obrigadoRef = useRef(null)
  // Para onde vai o foco quando o formulário fecha: de volta ao botão (cancelou) ou ao agradecimento (enviou)
  const [focarApos, setFocarApos] = useState(null)

  useEffect(() => {
    if (aberto) tituloFormRef.current?.focus()
    else if (focarApos === 'botao') botaoRef.current?.focus()
    else if (focarApos === 'obrigado') obrigadoRef.current?.focus()
  }, [aberto, focarApos])

  const cancelar = () => {
    setFocarApos('botao')
    setAberto(false)
  }

  return (
    <section id="avaliacoes" aria-labelledby="titulo-avaliacoes" className="mt-12 scroll-mt-28">
      <h2 id="titulo-avaliacoes" className="mb-1 text-h2">
        Avaliações
      </h2>
      <p className="mb-5 text-pequeno text-text-muted">
        Opiniões de quem visitou o site sobre {nomeItem}. A loja ainda não confere se a pessoa comprou o item.
      </p>

      {carregando ? (
        <div aria-busy="true" className="grid gap-4 desk:grid-cols-[minmax(0,22rem)_1fr]">
          <span className="sr-only">Carregando avaliações…</span>
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      ) : erro ? (
        <Aviso tipo="erro" role="alert" acao={<Button variant="secundario" onClick={recarregar}>Tentar de novo</Button>}>
          Não conseguimos carregar as avaliações agora.
        </Aviso>
      ) : (
        <div className="grid items-start gap-6 desk:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="rounded-card border border-border-strong bg-surface p-5">
            {resumo.total ? (
              <>
                <p className="font-display text-h1 font-extrabold text-foreground tabular-nums">
                  {numero.format(resumo.media)}
                  <span className="text-h4 text-text-muted"> de 5</span>
                </p>
                <EstrelasExibicao nota={resumo.media} />
                <p className="mt-1 mb-4 text-pequeno text-text-muted">
                  {resumo.total} {resumo.total === 1 ? 'avaliação' : 'avaliações'}
                </p>
                <ul className="space-y-2" aria-label="Distribuição das notas">
                  {resumo.distribuicao.map(({ nota, qtd }) => (
                    <BarraDistribuicao key={nota} rotulo={`${nota} ${nota === 1 ? 'estrela' : 'estrelas'}`} dica={ROTULO_NOTA[nota]} qtd={qtd} total={resumo.total} compacto />
                  ))}
                </ul>
              </>
            ) : (
              <div className="text-center">
                <MessageSquareText aria-hidden="true" className="mx-auto mb-2 size-8 text-primary-text" />
                <p className="font-display text-h4 font-extrabold">Ainda sem avaliações</p>
                <p className="mt-1 text-pequeno text-text-muted">Já conhece este item? Conte o que achou.</p>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-4 empty:hidden" role="status" aria-live="polite">
              {agradecer ? (
                <p ref={obrigadoRef} tabIndex={-1} className="flex items-start gap-2 text-pequeno font-semibold text-foreground outline-none">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-text" />
                  {agradecer === 'aprovada' ? MSG_PUBLICADA : MSG_PENDENTE}
                </p>
              ) : jaAvaliou ? (
                <p className="text-pequeno text-text-muted">Você já avaliou este item.</p>
              ) : null}
            </div>
            {!jaAvaliou && !aberto && (
              <Button ref={botaoRef} variant="secundario" largo onClick={() => { setFocarApos(null); setAberto(true) }}>
                <PenLine aria-hidden="true" />
                Avaliar este item
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {aberto && (
              <FormAvaliacao
                tituloRef={tituloFormRef}
                onCancelar={cancelar}
                onEnviar={async (campos) => {
                  const enviada = await enviar(campos)
                  setFocarApos('obrigado')
                  setAberto(false)
                  setAgradecer(enviada?.status ?? 'pendente')
                }}
              />
            )}

            {lista.length > 0 && (
              <>
                <ul className="divide-y divide-border rounded-card border border-border-strong bg-surface px-5">
                  {lista.slice(0, mostrar).map((a) => (
                    <li key={a.id} className="py-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <EstrelasExibicao nota={a.nota} className="size-4" />
                        <span className="text-pequeno font-bold text-foreground">
                          {a.nota} de 5<span className="sr-only">, {ROTULO_NOTA[a.nota]}</span>
                        </span>
                      </div>
                      {a.comentario && <p className="mt-2 text-corpo whitespace-pre-line text-foreground">{a.comentario}</p>}
                      <p className="mt-1.5 text-legenda text-text-muted">
                        {a.nome ?? 'Visitante'} · <time dateTime={a.criadaEm}>{dataCurta.format(new Date(a.criadaEm))}</time>
                      </p>
                    </li>
                  ))}
                </ul>
                {lista.length > mostrar && (
                  <Button variant="secundario" className="self-start" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
                    Mostrar mais avaliações ({lista.length - mostrar})
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function FormAvaliacao({ tituloRef, onCancelar, onEnviar }) {
  const { usuario } = useAuth()
  const [nota, setNota] = useState(0)
  const [nome, setNome] = useState(() => usuario?.nome?.trim().split(' ')[0] ?? '')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const restantes = LIMITE_COMENTARIO_PRODUTO - comentario.length

  const enviar = async (e) => {
    e.preventDefault()
    if (!nota || enviando) return
    setEnviando(true)
    setErro('')
    try {
      await onEnviar({ nota, nome, comentario })
    } catch (err) {
      setErro(err?.erro ?? 'Não foi possível enviar agora. Tente de novo em instantes.')
      setEnviando(false)
    }
  }

  return (
    <form
      id="form-avaliacao-produto"
      noValidate
      onSubmit={enviar}
      aria-labelledby="titulo-form-avaliacao"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
      className="flex flex-col gap-5 rounded-card border border-border-strong bg-surface-elevated p-5 shadow-soft"
    >
      <h3 id="titulo-form-avaliacao" ref={tituloRef} tabIndex={-1} className="text-h4 outline-none">
        Sua avaliação
      </h3>
      <EstrelasNota id="ap-nota" legenda="Que nota você dá?" valor={nota} onChange={setNota} />

      <div>
        <Label htmlFor="ap-nome" className="mb-1.5 text-pequeno font-semibold">
          Seu nome <span className="font-normal text-text-muted">(opcional)</span>
        </Label>
        <Input
          id="ap-nome"
          autoComplete="given-name"
          maxLength={LIMITE_NOME}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-describedby="ap-nome-ajuda"
        />
        <p id="ap-nome-ajuda" className="mt-1.5 text-legenda text-text-muted">
          Aparece junto da avaliação. Em branco, mostramos “Visitante”.
        </p>
      </div>

      <div>
        <Label htmlFor="ap-comentario" className="mb-1.5 text-pequeno font-semibold">
          Comentário <span className="font-normal text-text-muted">(opcional)</span>
        </Label>
        <Textarea
          id="ap-comentario"
          rows={4}
          maxLength={LIMITE_COMENTARIO_PRODUTO}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          aria-describedby="ap-contador"
          placeholder="Ex.: chegou bem embalado, fácil de instalar…"
        />
        <p id="ap-contador" className="mt-1.5 text-right text-legenda text-text-muted tabular-nums">
          {comentario.length}/{LIMITE_COMENTARIO_PRODUTO} caracteres
        </p>
        <p className="sr-only" aria-live="polite">
          {restantes <= 20 ? `Restam ${restantes} caracteres.` : ''}
        </p>
      </div>

      {erro && (
        <Aviso tipo="erro" role="alert">
          {erro}
        </Aviso>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="terciario" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!nota || enviando} aria-describedby={nota ? undefined : 'ap-dica'}>
          {enviando ? 'Enviando…' : 'Publicar avaliação'}
        </Button>
      </div>
      {!nota && (
        <p id="ap-dica" className="-mt-3 text-center text-legenda text-text-muted sm:text-right">
          Escolha uma nota para publicar.
        </p>
      )}
    </form>
  )
}

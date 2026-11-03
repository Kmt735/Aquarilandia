import { HelpCircle, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react'
import Button from '../atoms/Button'
import IconButton from '../atoms/IconButton'
import Imagem from '../atoms/Imagem'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import Aviso from '../molecules/Aviso'
import CompatibilityWarning from '../molecules/CompatibilityWarning'
import PriceEstimate from '../molecules/PriceEstimate'
import SeletorQuantidade from '../molecules/SeletorQuantidade'
import { LIMITE_QTD_MONTAGEM } from '../../lib/montagem'
import { formatarPreco, plural } from '../../utils/format'

const AGUA = { doce: 'água doce', marinho: 'água salgada', ambos: 'água doce ou salgada' }

// Lista da montagem: agrupada por etapa, com quantidade, subtotal, avisos, estimativa e as duas ações.
// Usada na lateral fixa (desktop) e na gaveta de baixo (celular).
export default function BuilderSummary({
  etapas, aquario, linhas, totais, avisos, resultadoCarrinho, onIrEtapa, onQtd, onRemover, onTirarAquarioProprio, onAdicionar, onOrientacao, onRecomecar, idTitulo = 'resumo-titulo',
}) {
  const qtdItens = etapas.reduce((s, e) => s + linhas[e.id].reduce((t, l) => t + l.qtd, 0), 0)
  const vazio = !aquario && qtdItens === 0
  const temCompravel = qtdItens > 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 id={idTitulo} className="text-h3">Sua lista</h2>
        <p className="text-pequeno text-text-muted">{qtdItens ? plural(qtdItens, 'item', 'itens') : 'Nenhum item ainda'}</p>
      </div>

      <div className="flex flex-col gap-4">
        {etapas.map((etapa, i) => {
          const grupo = linhas[etapa.id]
          const proprio = etapa.id === 'aquario' && aquario?.proprio
          return (
            <section key={etapa.id} aria-labelledby={`grupo-${etapa.id}-${idTitulo}`} className="border-b border-border pb-4 last:border-b-0">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 id={`grupo-${etapa.id}-${idTitulo}`} className="font-display text-corpo font-extrabold">
                  <button type="button" onClick={() => onIrEtapa(i)} className="alvo-toque rounded-sm text-left underline-offset-4 hover:text-primary-text hover:underline">
                    {etapa.rotulo}
                    <span className="sr-only"> (ir para a etapa)</span>
                  </button>
                </h3>
                {totais.porEtapa[etapa.id] > 0 && (
                  <span className="text-pequeno font-semibold tabular-nums">{formatarPreco(totais.porEtapa[etapa.id], { centavos: true })}</span>
                )}
              </div>

              {proprio ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-tint px-3 py-2 text-pequeno">
                  <span>Já tenho um aquário · {aquario.litros} L · {AGUA[aquario.tipoAgua]}</span>
                  <IconButton aria-label="Tirar o meu aquário da lista" className="size-9" onClick={onTirarAquarioProprio}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              ) : grupo.length === 0 ? (
                <p className="text-pequeno text-text-muted">
                  Nada escolhido ainda.{' '}
                  <button type="button" onClick={() => onIrEtapa(i)} className="alvo-toque font-semibold text-primary-text underline underline-offset-4">
                    Escolher {etapa.rotulo.toLowerCase()}
                  </button>
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {grupo.map((l) => {
                    const unitario = l.item.centavos ? l.item.preco : Math.round(l.item.preco * 100)
                    return (
                      <li key={l.id} className="flex gap-3">
                        <div className="w-12 shrink-0 overflow-hidden rounded-lg">
                          <Imagem src={l.item.imagens[0]?.src} alt="" categoria={l.item.categoria} proporcao="1/1" compacta />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-pequeno font-bold leading-snug">{l.item.nome}</p>
                          <p className="text-legenda text-text-muted tabular-nums">{formatarPreco(unitario, { centavos: true })} cada</p>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                            {etapa.id === 'aquario' ? <span className="text-legenda text-text-muted">1 unidade</span> : (
                              <SeletorQuantidade
                                compacto valor={l.qtd} onChange={(q) => onQtd(etapa.id, l.id, q)}
                                max={Math.min(l.item.estoque ?? LIMITE_QTD_MONTAGEM, LIMITE_QTD_MONTAGEM)} rotulo={`Quantidade de ${l.item.nome}`}
                              />
                            )}
                            <span className="text-pequeno font-bold tabular-nums">{formatarPreco(unitario * l.qtd, { centavos: true })}</span>
                          </div>
                        </div>
                        <IconButton aria-label={`Remover ${l.item.nome}`} className="size-9 self-start" onClick={() => onRemover(etapa.id, l.id)}>
                          <Trash2 aria-hidden="true" />
                        </IconButton>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {avisos.length > 0 && (
        <section aria-labelledby={`avisos-${idTitulo}`}>
          <h3 id={`avisos-${idTitulo}`} className="mb-2 font-display text-corpo font-extrabold">Avisos ({avisos.length})</h3>
          <p className="mb-3 text-legenda text-text-muted">Os avisos não impedem a compra. São para você decidir com segurança.</p>
          <ul className="flex flex-col gap-2">
            {avisos.map((a) => (
              <li key={a.id}>
                <CompatibilityWarning
                  aviso={a}
                  acao={(
                    <button type="button" onClick={() => onIrEtapa(etapas.findIndex((e) => e.id === a.etapa))} className="alvo-toque text-legenda font-bold text-primary-text underline underline-offset-4">
                      Ir para {etapas.find((e) => e.id === a.etapa)?.rotulo}
                    </button>
                  )}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <PriceEstimate etapas={etapas} totais={totais} />

      {resultadoCarrinho && <Aviso tipo={resultadoCarrinho.tipo} role="status">{resultadoCarrinho.texto}</Aviso>}

      <div className="flex flex-col gap-2">
        <Button tamanho="lg" largo disabled={!temCompravel} onClick={onAdicionar}>
          <ShoppingCart aria-hidden="true" />
          Adicionar ao carrinho
        </Button>
        {!temCompravel && <p className="text-center text-legenda text-text-muted">Escolha pelo menos um item da loja para adicionar.</p>}
        <Button tamanho="lg" largo variant="secundario" onClick={onOrientacao}>
          {vazio ? <HelpCircle aria-hidden="true" /> : <WhatsAppIcon className="size-[18px]" />}
          {vazio ? 'Ainda não sei o que escolher' : 'Pedir orientação da loja'}
        </Button>
        {vazio && <p className="text-center text-legenda text-text-muted">A loja te ajuda pelo WhatsApp.</p>}
        {!vazio && (
          <Button variant="terciario" className="self-center" onClick={onRecomecar}>
            <RotateCcw aria-hidden="true" />
            Começar de novo
          </Button>
        )}
      </div>
    </div>
  )
}

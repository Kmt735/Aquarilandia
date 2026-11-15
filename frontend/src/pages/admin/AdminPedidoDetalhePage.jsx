import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Skeleton from '../../components/atoms/Skeleton'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import CampoOpcoes from '../../components/molecules/CampoOpcoes'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import FormField from '../../components/molecules/FormField'
import LinhaDoTempoPedido from '../../components/organisms/LinhaDoTempoPedido'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import useToast from '../../hooks/useToast'
import { atualizarPedidoAdmin, obterPedidoAdmin } from '../../services/admin-pedidos'
import { formatarDataHora } from '../../utils/format'
import { marcarVisto } from '../../utils/pedidosVistos'
import { ROTAS } from '../../utils/rotas'
import { ANDAMENTO_ADMIN, ENTREGA_ADMIN, PAGAMENTO_ADMIN } from '../../utils/statusAdminPedido'

const caixa = 'rounded-card border border-border-strong bg-surface p-5'

export default function AdminPedidoDetalhePage() {
  const { id } = useParams()
  useTituloPagina(`Pedido ${id}`)
  const { dados, carregando, erro, recarregar } = useConsulta(() => obterPedidoAdmin(id), [id])

  // Abrir o pedido tira o selo "Novo" e diminui o número da aba
  useEffect(() => {
    marcarVisto(id)
  }, [id])

  const voltar = (
    <Link
      to={ROTAS.adminPedidos}
      className="alvo-toque mb-6 inline-flex items-center gap-1.5 text-pequeno font-semibold text-primary-text underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar para os pedidos
    </Link>
  )

  if (carregando && !dados) return <Skeleton className="h-96 rounded-card" />
  if (erro) {
    return (
      <>
        {voltar}
        <ErroCompacto onTentar={recarregar}>{erro.message}</ErroCompacto>
      </>
    )
  }
  return <Detalhe key={dados.id} inicial={dados} voltar={voltar} />
}

function Detalhe({ inicial, voltar }) {
  const { toast } = useToast()
  const [pedido, setPedido] = useState(inicial)
  const [status, setStatus] = useState(inicial.status)
  const [pagamento, setPagamento] = useState(inicial.pagamento)
  const [situacao, setSituacao] = useState(inicial.entrega.situacao)
  const [rastreio, setRastreio] = useState(inicial.rastreio ?? '')
  const [salvando, setSalvando] = useState(false)

  const tipo = pedido.entrega.tipo
  const alterado =
    status !== pedido.status ||
    pagamento !== pedido.pagamento ||
    situacao !== pedido.entrega.situacao ||
    rastreio.trim() !== (pedido.rastreio ?? '')

  const salvar = async () => {
    setSalvando(true)
    try {
      const novo = await atualizarPedidoAdmin(pedido.id, { status, pagamento, entregaSituacao: situacao, rastreio })
      setPedido(novo)
      setStatus(novo.status)
      setPagamento(novo.pagamento)
      setSituacao(novo.entrega.situacao)
      setRastreio(novo.rastreio ?? '')
      toast('Pedido atualizado.', { tipo: 'sucesso' })
    } catch (e) {
      toast(e.erro ?? 'Não foi possível salvar agora. Tente de novo.', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  const telefone = pedido.cliente?.telefone?.replace(/\D/g, '')
  const linkCliente = telefone ? `https://wa.me/${telefone.length <= 11 ? `55${telefone}` : telefone}` : null

  return (
    <article aria-labelledby="titulo-pedido">
      {voltar}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 id="titulo-pedido" className="text-h3">
          Pedido {pedido.id}
        </h2>
        <StatusPedidoBadge status={pedido.status} />
      </div>
      <p className="mb-6 text-pequeno text-text-muted">Feito em {formatarDataHora(pedido.criadoEm)}</p>

      <div className="grid items-start gap-6 desk:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="titulo-cliente" className={caixa}>
            <h3 id="titulo-cliente" className="mb-3 text-h4">
              Cliente
            </h3>
            {pedido.cliente ? (
              <dl className="grid gap-2 text-pequeno">
                <div>
                  <dt className="text-legenda text-text-muted">Nome</dt>
                  <dd className="font-semibold">{pedido.cliente.nome}</dd>
                </div>
                <div>
                  <dt className="text-legenda text-text-muted">WhatsApp</dt>
                  <dd>
                    {linkCliente ? (
                      <a href={linkCliente} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-text underline underline-offset-4">
                        {pedido.cliente.telefone} (abrir conversa)
                      </a>
                    ) : (
                      'Não informado'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-legenda text-text-muted">E-mail</dt>
                  <dd>{pedido.cliente.email}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-pequeno text-text-muted">Cliente não informado (pedido de exemplo).</p>
            )}
          </section>

          <section aria-labelledby="titulo-entrega" className={caixa}>
            <h3 id="titulo-entrega" className="mb-3 text-h4">
              {tipo === 'retirada' ? 'Retirada na loja' : 'Entrega'}
            </h3>
            <p className="text-pequeno">{pedido.entrega.resumo}</p>
          </section>

          <ResumoPedido itens={pedido.itens} frete={pedido.entrega.frete} titulo="Itens do pedido" />
        </div>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="titulo-atualizar" className={caixa}>
            <h3 id="titulo-atualizar" className="mb-4 text-h4">
              Atualizar pedido
            </h3>
            <FormField id="ped-andamento" label="Andamento do pedido" obrigatorio>
              <CampoOpcoes
                name="status"
                opcoes={ANDAMENTO_ADMIN.map((o) => [o.valor, o.rotulo])}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </FormField>
            <FormField id="ped-pagamento" label="Pagamento" obrigatorio>
              <CampoOpcoes
                name="pagamento"
                opcoes={PAGAMENTO_ADMIN.map((o) => [o.valor, o.rotulo])}
                value={pagamento}
                onChange={(e) => setPagamento(e.target.value)}
              />
            </FormField>
            <FormField id="ped-entrega" label={tipo === 'retirada' ? 'Situação da retirada' : 'Situação da entrega'} obrigatorio>
              <CampoOpcoes
                name="entregaSituacao"
                opcoes={ENTREGA_ADMIN[tipo].map((o) => [o.valor, o.rotulo])}
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
              />
            </FormField>
            {tipo === 'endereco' && (
              <FormField id="ped-rastreio" label="Código de rastreio" ajuda="O cliente vê esse código na página da compra.">
                <Input autoComplete="off" value={rastreio} onChange={(e) => setRastreio(e.target.value)} />
              </FormField>
            )}
            <Button tamanho="lg" largo disabled={!alterado || salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </section>

          <section aria-labelledby="titulo-historico" className={caixa}>
            <h3 id="titulo-historico" className="mb-4 text-h4">
              Histórico
            </h3>
            <LinhaDoTempoPedido pedido={pedido} />
          </section>
        </div>
      </div>
    </article>
  )
}
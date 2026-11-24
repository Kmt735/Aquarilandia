import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../../components/atoms/Button'
import Aviso from '../../components/molecules/Aviso'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import PagamentoPix from '../../components/organisms/PagamentoPix'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useCheckout from '../../hooks/useCheckout'
import useConsulta from '../../hooks/useConsulta'
import { gerarCartao, gerarPix, obterPedido } from '../../services/pedidos'

// Retoma um pedido já reservado, mesmo que seu último produto tenha esgotado e saído do carrinho.
export default function PagamentoExistente({ id }) {
  const { rascunho, salvar } = useCheckout()
  const [metodo, setMetodo] = useState(rascunho.metodoPagamento ?? 'pix')
  const [pagamento, setPagamento] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)
  const navigate = useNavigate()
  const consulta = useConsulta(() => obterPedido(id), [id])
  const pedido = consulta.dados
  useEffect(() => {
    if (!pedido) return
    if (pedido.status !== 'aguardando_pagamento') {
      navigate(`/pagamento/sucesso?pedido=${encodeURIComponent(id)}`, { replace: true })
      return
    }
    const timer = setTimeout(consulta.recarregar, 3000)
    return () => clearTimeout(timer)
  }, [pedido, id, navigate, consulta.recarregar])
  if (consulta.erro) return <ErroCompacto onTentar={consulta.recarregar}>{consulta.erro.message}</ErroCompacto>
  if (!pedido) return <p role="status">Carregando sua compra…</p>
  const atual = pagamento?.metodo === metodo ? pagamento : null
  return <div className="grid items-start gap-8 desk:grid-cols-[1fr_360px]">
    <section className="space-y-4">
      <h2 className="text-h2">Pagamento da compra {pedido.id}</h2>
      <p>{pedido.entrega.resumo}</p>
      <fieldset disabled={ocupado} className="space-y-3"><legend className="mb-3 font-bold">Forma de pagamento</legend>
        {[['pix', 'Pix'], ['cartao', 'Cartão de crédito ou débito']].map(([valor, titulo]) => <label key={valor} className="flex min-h-14 items-center gap-3 rounded-card border border-border-control p-4"><input type="radio" className="size-5 accent-primary" name="pagamento-existente" checked={metodo === valor} onChange={() => { setMetodo(valor); salvar({ metodoPagamento: valor }); setErro(null) }} />{titulo}</label>)}
      </fieldset>
      <p>A confirmação do pagamento é feita pela AbacatePay. Os dados do cartão são informados na página de pagamento.</p>
      {erro && <Aviso tipo="erro" role="alert">{erro}</Aviso>}
      {atual?.codigoPix && <PagamentoPix key={atual.pagamentoId} pix={atual} pedidoId={pedido.id} />}
    </section>
    <ResumoPedido itens={pedido.itens} frete={pedido.frete / 100} subtotalCentavos={pedido.subtotal} totalCentavos={pedido.total}>
      {atual?.url ? <Button asChild largo className="mt-5"><a href={atual.url}>Pagar na AbacatePay</a></Button> : <Button largo className="mt-5" disabled={ocupado || pedido.status !== 'aguardando_pagamento'} onClick={async () => {
        setOcupado(true); setErro(null)
        try { setPagamento({ ...await (metodo === 'cartao' ? gerarCartao(id) : gerarPix(id)), metodo }) }
        catch (err) { setErro(err.message); consulta.recarregar() }
        finally { setOcupado(false) }
      }}>{ocupado ? 'Preparando pagamento…' : metodo === 'cartao' ? 'Pagar com cartão' : 'Gerar Pix'}</Button>}
    </ResumoPedido>
  </div>
}

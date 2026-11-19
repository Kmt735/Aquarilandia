import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import Button from '../../components/atoms/Button'
import Aviso from '../../components/molecules/Aviso'
import PagamentoPix from '../../components/organisms/PagamentoPix'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useCart from '../../hooks/useCart'
import useCheckout from '../../hooks/useCheckout'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import { cotarCompra } from '../../services/frete'
import { consultarStatus, criarPedido, gerarCartao, gerarPix, itensDaCompra } from '../../services/pedidos'
import { formatarPreco } from '../../utils/format'
import PagamentoExistente from './PagamentoExistente'
import { urlEtapaCheckout } from '../../utils/rotas'

export default function EtapaPagamentoPage() {
  const [params] = useSearchParams()
  const id = params.get('pedido')
  return id ? <PagamentoExistente key={id} id={id} /> : <NovoPagamento />
}

function NovoPagamento() {
  useTituloPagina('Pagamento · Finalizar compra')
  const { linhas } = useCart()
  const { rascunho, salvar } = useCheckout()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [metodo, setMetodo] = useState(rascunho.metodoPagamento ?? 'pix')
  const [dadosCartao, setCartao] = useState(null)
  const [dadosPix, setPix] = useState(null)
  const [pedido, setPedido] = useState(null)
  const tentativa = useRef(rascunho.compra)
  const entrega = rascunho.entrega
  const assinatura = JSON.stringify([itensDaCompra(linhas), entrega?.tipo, entrega?.escolha, entrega?.cep, entrega?.unidadeRetirada, entrega?.servicoFreteId])
  const { dados: cotacao, carregando, erro: erroCotacao, recarregar } = useConsulta(
    () => entrega ? cotarCompra(linhas, entrega) : Promise.resolve(null), [assinatura],
  )
  const cartao = dadosCartao?.assinatura === assinatura && dadosCartao?.total === cotacao?.total ? dadosCartao : null
  const pix = dadosPix?.assinatura === assinatura && dadosPix?.total === cotacao?.total ? dadosPix : null
  useEffect(() => {
    if (!pedido?.id) return
    let ativo = true, timer
    const conferir = async () => {
      try {
        const atual = await consultarStatus(pedido.id)
        if (!ativo) return
        if (atual.status !== 'aguardando_pagamento') {
          navigate(`/pagamento/sucesso?pedido=${encodeURIComponent(atual.id)}`, { replace: true })
          return
        }
      } catch { /* Uma falha de consulta nunca equivale a pagamento confirmado. */ }
      if (ativo) timer = setTimeout(conferir, 3000)
    }
    conferir()
    return () => { ativo = false; clearTimeout(timer) }
  }, [pedido?.id, navigate])

  if (!entrega?.tipo || (entrega.tipo === 'retirada' && !['centro','matosinhos'].includes(entrega.unidadeRetirada)) || (entrega.tipo !== 'retirada' && !entrega.cep)) return <Navigate to={urlEtapaCheckout('entrega')} replace />

  const pagar = async () => {
    if (!cotacao || enviando) return
    setEnviando(true); setErro(null)
    try {
      const fingerprint = JSON.stringify([assinatura, cotacao.total])
      if (tentativa.current?.fingerprint !== fingerprint) {
        tentativa.current = { fingerprint, chave: crypto.randomUUID() }
        salvar({ compra: tentativa.current })
      }
      const criado = await criarPedido({ linhas, entrega, totalEsperado: cotacao.total, chave: tentativa.current.chave })
      setPedido(criado)
      if (metodo === 'cartao') setCartao({ ...await gerarCartao(criado.id), assinatura, total: cotacao.total })
      else setPix({ ...await gerarPix(criado.id), assinatura, total: cotacao.total })
      salvar({ compra: { ...tentativa.current, pedidoId: criado.id } })
    } catch (e) {
      setErro(e.message ?? 'Não foi possível preparar o pagamento. Tente novamente.')
      if (e.status === 409) recarregar()
    } finally { setEnviando(false) }
  }
  const itens = linhas.map((l) => ({ id: l.id, nome: l.item.nome, preco: l.item.preco, centavos: l.item.centavos, qtd: l.qtd }))
  return (
    <div className="grid items-start gap-8 desk:grid-cols-[1fr_360px]">
      <section className="flex flex-col gap-4" aria-labelledby="titulo-pagamento">
        <h2 id="titulo-pagamento" className="text-h2">Escolha como pagar</h2>
        <p className="rounded-card border border-border-strong bg-surface p-5">{entrega.resumo}</p>
        <fieldset disabled={enviando} className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">Forma de pagamento</legend>
          {[['pix', 'Pix', 'QR code ou código copia e cola.'], ['cartao', 'Cartão de crédito ou débito', 'Pagamento na página segura da AbacatePay.']].map(([valor, titulo, descricao]) => <label key={valor} className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 ${metodo === valor ? 'border-primary bg-primary-soft' : 'border-border-control bg-surface'}`}>
            <input className="mt-1 size-5 shrink-0 accent-primary" type="radio" name="metodo-pagamento" value={valor} checked={metodo === valor} onChange={() => { setMetodo(valor); salvar({ metodoPagamento: valor }); setErro(null) }} />
            <span><span className="block font-bold">{titulo}</span><span className="mt-1 block text-sm text-text-muted">{descricao}</span></span>
          </label>)}
        </fieldset>
        <p>A AbacatePay processa o pagamento. Sua compra será confirmada assim que o pagamento for aprovado.</p>
        {erroCotacao && <Aviso tipo="erro" role="alert">{erroCotacao.message} <Button onClick={recarregar}>Tentar novamente</Button></Aviso>}
        {erro && <Aviso tipo="erro" role="alert">{erro}</Aviso>}
        {metodo === 'pix' && pix && <PagamentoPix key={pix.pagamentoId} pix={pix} pedidoId={pedido.id} />}
        {metodo === 'cartao' && cartao && <section className="rounded-card border border-border-strong bg-surface p-5" aria-label="Pagamento com cartão">
          <h3 className="text-h3">Cartão da compra {pedido.id}</h3>
          <p className="mt-2">Continue na AbacatePay para informar os dados do cartão e concluir o pagamento. Crédito e débito são escolhidos conforme as opções disponíveis na página de pagamento.</p>
          <p className="mt-3 text-sm text-text-muted">Seu pedido fica reservado até {new Date(cartao.expiraEm).toLocaleString('pt-BR')}.</p>
        </section>}
        <Link className="font-semibold underline" to={urlEtapaCheckout('entrega')}>Alterar entrega</Link>
      </section>
      <ResumoPedido itens={itens} frete={cotacao ? cotacao.frete / 100 : undefined}
        subtotalCentavos={cotacao?.subtotal} totalCentavos={cotacao?.total}>
        {metodo === 'cartao' && cartao && !carregando ? <Button asChild tamanho="lg" largo className="mt-5"><a href={cartao.url}>Pagar na AbacatePay</a></Button> : <Button tamanho="lg" largo className="mt-5" onClick={pagar} disabled={carregando || !cotacao || enviando}>
          {enviando ? 'Preparando pagamento…' : metodo === 'cartao' ? `Pagar com cartão${cotacao ? ` · ${formatarPreco(cotacao.total, { centavos: true })}` : ''}` : pix ? 'Recuperar código Pix' : `Gerar Pix${cotacao ? ` de ${formatarPreco(cotacao.total, { centavos: true })}` : ''}`}
        </Button>}
      </ResumoPedido>
    </div>
  )
}

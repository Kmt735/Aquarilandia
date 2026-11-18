import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import Button from '../../components/atoms/Button'
import Aviso from '../../components/molecules/Aviso'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useCart from '../../hooks/useCart'
import useCheckout from '../../hooks/useCheckout'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import { cotarCompra } from '../../services/frete'
import { consultarStatus, criarPedido, gerarPix, itensDaCompra } from '../../services/pedidos'
import { formatarPreco } from '../../utils/format'
import { urlEtapaCheckout } from '../../utils/rotas'

export default function EtapaPagamentoPage() {
  useTituloPagina('Pagamento · Finalizar compra')
  const { linhas } = useCart()
  const { rascunho, salvar } = useCheckout()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [pix, setPix] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const tentativa = useRef(rascunho.compra)
  const entrega = rascunho.entrega
  const assinatura = JSON.stringify([itensDaCompra(linhas), entrega?.tipo, entrega?.escolha, entrega?.cep, entrega?.unidadeRetirada, entrega?.servicoFreteId])
  const { dados: cotacao, carregando, erro: erroCotacao, recarregar } = useConsulta(
    () => entrega ? cotarCompra(linhas, entrega) : Promise.resolve(null), [assinatura],
  )
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
      setPix(await gerarPix(criado.id))
    } catch (e) {
      setErro(e.erro ?? 'Não foi possível gerar o Pix. Tente novamente.')
      if (e.status === 409) recarregar()
    } finally { setEnviando(false) }
  }
  const itens = linhas.map((l) => ({ id: l.id, nome: l.item.nome, preco: l.item.preco, centavos: l.item.centavos, qtd: l.qtd }))
  return (
    <div className="grid items-start gap-8 desk:grid-cols-[1fr_360px]">
      <section className="flex flex-col gap-4" aria-labelledby="titulo-pagamento">
        <h2 id="titulo-pagamento" className="text-h2">Revise e pague com Pix</h2>
        <p className="rounded-card border border-border-strong bg-surface p-5">{entrega.resumo}</p>
        <p>O Pix é gerado pela AbacatePay. A compra só será confirmada após a confirmação do pagamento.</p>
        {erroCotacao && <Aviso tipo="erro" role="alert">{erroCotacao.message} <Button onClick={recarregar}>Tentar novamente</Button></Aviso>}
        {erro && <Aviso tipo="erro" role="alert">{erro}</Aviso>}
        {pix && (
          <section className="rounded-card border border-border-strong bg-surface p-5" aria-label="Pagamento Pix">
            <h3 className="text-h3">Pix da compra {pedido.id}</h3>
            <img className="mx-auto my-4 size-64" src={pix.qrCodeImagem} alt="QR code para pagar a compra com Pix" />
            <label className="block font-semibold" htmlFor="codigo-pix">Pix copia e cola</label>
            <textarea id="codigo-pix" className="mt-2 w-full rounded-lg border p-3" readOnly value={pix.codigoPix} />
            <Button onClick={async () => {
              try { await navigator.clipboard.writeText(pix.codigoPix); setCopiado(true) }
              catch { setErro('Selecione e copie o código Pix acima.') }
            }}>{copiado ? 'Código copiado' : 'Copiar código Pix'}</Button>
            <p className="mt-3 text-pequeno">Válido até {new Date(pix.expiraEm).toLocaleString('pt-BR')}. Aguardando confirmação.</p>
          </section>
        )}
        <Link className="font-semibold underline" to={urlEtapaCheckout('entrega')}>Alterar entrega</Link>
      </section>
      <ResumoPedido itens={itens} frete={cotacao ? cotacao.frete / 100 : undefined}
        subtotalCentavos={cotacao?.subtotal} totalCentavos={cotacao?.total}>
        <Button tamanho="lg" largo className="mt-5" onClick={pagar} disabled={carregando || !cotacao || enviando}>
          {enviando ? 'Gerando Pix…' : pix ? 'Recuperar código Pix' : `Gerar Pix${cotacao ? ` de ${formatarPreco(cotacao.total, { centavos: true })}` : ''}`}
        </Button>
      </ResumoPedido>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Aviso from '../molecules/Aviso'
import useConsulta from '../../hooks/useConsulta'
import { configuracaoPagamento, simularPagamentoDeTeste } from '../../services/pedidos'

export default function PagamentoPix({ pix, pedidoId }) {
  const [copiado, setCopiado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)
  const [mensagem, setMensagem] = useState(null)
  const configuracao = useConsulta(configuracaoPagamento, [])
  const navigate = useNavigate()
  return <section className="rounded-card border border-border-strong bg-surface p-5" aria-label="Pagamento Pix">
    <h3 className="text-h3">Pix da compra {pedidoId}</h3>
    <img className="mx-auto my-4 size-64 max-w-full" src={pix.qrCodeImagem} alt="QR code para pagar a compra com Pix" />
    <label className="block font-semibold" htmlFor="codigo-pix">Pix copia e cola</label>
    <textarea id="codigo-pix" className="mt-2 w-full rounded-lg border p-3" readOnly value={pix.codigoPix} />
    <Button variant="secundario" onClick={async () => {
      try { await navigator.clipboard.writeText(pix.codigoPix); setCopiado(true) }
      catch { setErro('Selecione e copie o código Pix acima.') }
    }}>{copiado ? 'Código copiado' : 'Copiar código Pix'}</Button>
    <p className="mt-3 text-sm">Válido até {new Date(pix.expiraEm).toLocaleString('pt-BR')}. Aguardando confirmação.</p>
    {configuracao.dados?.simulacaoPix && <div className="mt-5 space-y-3 border-t border-border pt-4">
      <Aviso tipo="info">Ambiente de teste: conclua a compra sem transferir dinheiro. A confirmação será consultada na AbacatePay.</Aviso>
      <Button disabled={ocupado} onClick={async () => {
        if (ocupado) return
        setOcupado(true); setErro(null); setMensagem(null)
        try {
          const pedido = await simularPagamentoDeTeste(pedidoId)
          if (pedido.pagamento?.status === 'aprovado' && ['paga', 'em_separacao', 'enviada', 'pronta_retirada', 'entregue'].includes(pedido.status)) {
            navigate(`/pagamento/sucesso?pedido=${encodeURIComponent(pedidoId)}`, { replace: true })
          } else setMensagem('O pagamento ainda não foi confirmado. Aguarde a atualização da compra.')
        } catch (err) { setErro(err.message) }
        finally { setOcupado(false) }
      }}>{ocupado ? 'Confirmando pagamento de teste…' : 'Simular pagamento de teste'}</Button>
    </div>}
    {erro && <Aviso className="mt-3" tipo="erro" role="alert">{erro}</Aviso>}
    {mensagem && <p className="mt-3" role="status">{mensagem}</p>}
  </section>
}

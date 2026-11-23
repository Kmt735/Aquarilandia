import { MessageSquareHeart } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../atoms/Button'
import useUI from '../../hooks/useUI'
import { podeConvidarPosCompra, registrarConvitePosCompra } from '../../services/avaliacoes'

// Convite curto depois de uma compra concluída. Aparece UMA vez por navegador (e nunca para quem já avaliou).
export default function ConviteAvaliacao() {
  const { abrirAvaliacao } = useUI()
  const [mostrar] = useState(podeConvidarPosCompra)

  useEffect(() => {
    if (mostrar) registrarConvitePosCompra()
  }, [mostrar])

  if (!mostrar) return null
  return (
    <div className="mx-auto mt-10 flex max-w-[480px] flex-col items-center gap-3 rounded-xl border border-border-strong bg-surface-tint px-5 py-4 text-left sm:flex-row">
      <MessageSquareHeart aria-hidden="true" className="size-6 shrink-0 text-primary-text" />
      <p className="flex-1 text-pequeno text-foreground">
        <strong>Como foi comprar pelo site?</strong> Conte em menos de 1 minuto.
      </p>
      <Button variant="secundario" onClick={() => abrirAvaliacao('pos-compra')}>
        Avaliar o site
      </Button>
    </div>
  )
}

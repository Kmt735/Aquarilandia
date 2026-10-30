import Aviso from './Aviso'
import { AVISO_PEIXE } from '../../services/frete'

// Regra de negócio: peixe vivo só é entregue em São João del Rei (itens 5, 18, 28).
// Aparece no card (selo), na ficha e no carrinho (esta caixa).
export default function AvisoEntregaPeixe({ className = '', compacto = false }) {
  return (
    <Aviso tipo="info" titulo={compacto ? null : 'Entrega de peixes'} className={className}>
      {AVISO_PEIXE}
    </Aviso>
  )
}

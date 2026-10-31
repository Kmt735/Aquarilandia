import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import CtaBanner from '../molecules/CtaBanner'
import { passosGuia } from '../../data/guia'
import { ROTAS } from '../../utils/rotas'

// Chamada para o guia do iniciante (item 10)
export default function GuideCta() {
  const navigate = useNavigate()
  return (
    <CtaBanner
      eyebrow="Sou iniciante"
      titulo="Nunca teve um aquário? Comece aqui."
      texto={`Um passo a passo em ${passosGuia.length} etapas, do zero à manutenção, com as palavras difíceis explicadas.`}
      acoes={
        <Button tamanho="lg" onClick={() => navigate(ROTAS.primeiroAquario, { state: { iniciarGuia: true } })}>
          Começar o guia
        </Button>
      }
      className="py-4"
    />
  )
}

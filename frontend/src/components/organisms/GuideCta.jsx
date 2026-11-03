import { Link, useNavigate } from 'react-router'
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
        <>
          <Button tamanho="lg" onClick={() => navigate(`${ROTAS.primeiroAquario}#${passosGuia[0].id}`)}>
            Começar o guia
          </Button>
          <Button
            tamanho="lg"
            variant="secundario"
            asChild
            className="border-on-primary-dark/60 text-on-primary-dark hover:border-on-primary-dark hover:bg-on-primary-dark/10 hover:text-on-primary-dark"
          >
            <Link to={ROTAS.monteSeuAquario}>Monte seu aquário</Link>
          </Button>
        </>
      }
      className="py-4"
    />
  )
}

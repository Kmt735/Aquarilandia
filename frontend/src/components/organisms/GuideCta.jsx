import { useNavigate } from 'react-router'
import CtaBanner from '../molecules/CtaBanner'
import { passosGuia } from '../../data/guia'
import { ROTAS } from '../../utils/rotas'

export default function GuideCta() {
  const navigate = useNavigate()

  return (
    <CtaBanner
      eyebrow="Área educativa"
      titulo="Nunca teve um aquário? Comece aqui."
<<<<<<< Updated upstream
      texto="Um passo a passo simples, do zero à manutenção, pensado pra quem nunca montou um aquário na vida."
      acao="Começar guia"
      onAcao={() => navigate(ROTAS.primeiroAquario, { state: { iniciarGuia: true } })}
      className="pb-20 desk:pb-24"
    >
      <div aria-hidden="true" className="mt-5 flex gap-2">
        {passosGuia.map((passo, i) => (
          <span key={passo.titulo} className={`size-2 rounded-full bg-accent ${i === 0 ? '' : 'opacity-30'}`} />
        ))}
      </div>
    </CtaBanner>
=======
      texto={`Um passo a passo em ${passosGuia.length} etapas, do zero à manutenção, com as palavras difíceis explicadas.`}
      acoes={
        <Button tamanho="lg" onClick={() => navigate(`${ROTAS.primeiroAquario}#${passosGuia[0].id}`)}>
          Começar o guia
        </Button>
      }
      className="py-4"
    />
>>>>>>> Stashed changes
  )
}

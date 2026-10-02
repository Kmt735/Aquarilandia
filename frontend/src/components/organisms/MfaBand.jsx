import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import ScriptText from '../atoms/ScriptText'
import Section from '../atoms/Section'
import { passosGuia } from '../../data/guia'
import { ROTAS } from '../../utils/rotas'

export default function MfaBand() {
  const navigate = useNavigate()

  return (
    <Section>
      <div className="flex flex-col items-start justify-between gap-8 rounded-card border border-line bg-panel p-8 desk:flex-row desk:items-center desk:p-12">
        <div>
          <Eyebrow tom="cyan">Área educativa</Eyebrow>
          <h2 className="max-w-[420px] text-[25px]">
            Nunca teve um aquário? <ScriptText cor="gold">Comece aqui.</ScriptText>
          </h2>
          <p className="mt-2.5 max-w-[420px] text-ink-soft">
            Um passo a passo simples, do zero à manutenção, pensado pra quem nunca montou um aquário na vida.
          </p>
          <div className="mt-[18px] flex gap-2">
            {passosGuia.map((passo, i) => (
              <span key={passo.titulo} className={`size-2 rounded-full bg-gold ${i === 0 ? '' : 'opacity-25'}`} />
            ))}
          </div>
        </div>
        <Button onClick={() => navigate(ROTAS.primeiroAquario, { state: { iniciarGuia: true } })}>
          Começar guia
        </Button>
      </div>
    </Section>
  )
}

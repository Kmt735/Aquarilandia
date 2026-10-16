import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import Highlight from '../atoms/Highlight'

export default function GuideHero({ onIniciar }) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 sm:px-6 desk:grid-cols-[1.3fr_1fr] desk:items-end desk:px-10 desk:py-24">
        <div>
          <Eyebrow>Área educativa</Eyebrow>
          <h1 className="mt-5 max-w-[620px] text-[40px] leading-[1.04] desk:text-[56px]">
            Você nunca teve um aquário? <Highlight bloco>Comece aqui.</Highlight>
          </h1>
        </div>
        <div>
          <p className="mb-7 max-w-[440px] text-[17px] leading-relaxed text-text-muted">
            Sete passos simples pra sair do zero até um aquário saudável e funcionando — sem enrolação.
          </p>
          <Button onClick={onIniciar}>Iniciar guia passo a passo</Button>
        </div>
      </div>
    </div>
  )
}

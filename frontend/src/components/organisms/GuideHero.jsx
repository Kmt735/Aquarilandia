import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import ScriptText from '../atoms/ScriptText'

export default function GuideHero({ onIniciar }) {
  return (
    <div className="border-b border-line bg-mfa-hero px-4 py-[70px] text-center text-white desk:px-10">
      <Eyebrow>Área educativa</Eyebrow>
      <h1 className="mx-auto mt-3.5 mb-3 max-w-[560px] text-4xl">
        Você nunca teve um aquário?{' '}
        <ScriptText cor="gold" bloco>
          Comece aqui.
        </ScriptText>
      </h1>
      <p className="mx-auto mb-[26px] max-w-[480px] text-ink-soft">
        Sete passos simples pra sair do zero até um aquário saudável e funcionando — sem enrolação.
      </p>
      <Button onClick={onIniciar}>Iniciar guia passo a passo</Button>
    </div>
  )
}

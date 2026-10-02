import Eyebrow from '../atoms/Eyebrow'
import GlowFrame from '../atoms/GlowFrame'
import Section from '../atoms/Section'

export default function AboutSection() {
  return (
    <Section className="flex flex-col items-center gap-14 desk:flex-row">
      <GlowFrame
        className="w-full max-w-[320px] shrink-0"
        innerClassName="flex h-[280px] items-center justify-center text-5xl"
      >
        📍
      </GlowFrame>
      <div>
        <Eyebrow tom="cyan">Quem somos</Eyebrow>
        <h2 className="text-2xl">Feito por quem também tem aquário em casa.</h2>
        <p className="mt-3.5 leading-[1.7] text-ink-soft">
          A Aquarilândia trabalha com peixes nacionais e importados e projetos de aquários. Selecionamos cada peixe
          com cuidado e damos suporte real, do primeiro aquário aos projetos plantados mais elaborados.
        </p>
      </div>
    </Section>
  )
}

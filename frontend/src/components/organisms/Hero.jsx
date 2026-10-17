import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import Highlight from '../atoms/Highlight'
import { ROTAS } from '../../utils/rotas'

export default function Hero() {
  const navigate = useNavigate()

  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-14 pb-16 sm:px-6 desk:grid-cols-[1fr_1.1fr] desk:gap-16 desk:px-10 desk:pt-20 desk:pb-24">
        <div>
          <Eyebrow>Peixes nacionais e importados</Eyebrow>
          <h1 className="mt-5 mb-5 text-[42px] leading-[1.02] desk:text-[64px]">
            Seu aquário é um <Highlight bloco>ecossistema.</Highlight>
          </h1>
          <p className="mb-8 max-w-[440px] text-[17px] leading-relaxed text-text-muted">
            Peixes, plantas e projetos de aquários. A qualidade que você já conhece, agora pertinho de você.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate(ROTAS.loja)}>Ver produtos</Button>
            <Button variant="ghost" onClick={() => navigate(ROTAS.primeiroAquario)}>
              Sou iniciante →
            </Button>
          </div>
        </div>

        {/* Ilustração no lugar da foto principal, numa moldura de foto (proporção fixa, cantos arredondados) */}
        <figure className="relative overflow-hidden rounded-[20px] border border-border bg-surface-muted">
          <div className="relative aspect-[4/3] w-full">
            <svg viewBox="0 0 300 240" className="absolute inset-0 size-full" aria-hidden="true">
              <g className="text-primary-text">
                <ellipse cx="90" cy="110" rx="26" ry="14" fill="currentColor" />
                <path d="M116 110 l16 -12 l0 24 z" fill="currentColor" />
              </g>
              <g className="text-primary-text opacity-60">
                <ellipse cx="190" cy="70" rx="18" ry="10" fill="currentColor" />
                <path d="M208 70 l12 -9 l0 18 z" fill="currentColor" />
              </g>
              <g className="text-primary-text opacity-40">
                <ellipse cx="150" cy="160" rx="15" ry="8" fill="currentColor" />
                <path d="M165 160 l10 -7 l0 14 z" fill="currentColor" />
              </g>
              <circle cx="240" cy="140" r="3" fill="var(--neon)" />
              <circle cx="250" cy="120" r="2" fill="var(--neon)" />
              <circle cx="50" cy="60" r="2.5" fill="var(--neon)" />
            </svg>
          </div>
          <span aria-hidden="true" className="neon-line absolute inset-x-8 bottom-0 h-px" />
        </figure>
      </div>
    </section>
  )
}

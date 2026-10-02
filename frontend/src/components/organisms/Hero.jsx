import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import GlowFrame from '../atoms/GlowFrame'
import ScriptText from '../atoms/ScriptText'
import { ROTAS } from '../../utils/rotas'

export default function Hero() {
  const navigate = useNavigate()

  return (
    <div className="relative overflow-hidden bg-hero px-4 pt-[76px] text-white desk:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-12 pb-16 desk:flex-row">
        <div className="flex-1">
          <Eyebrow>Peixes nacionais e importados</Eyebrow>
          <h1 className="mt-4 mb-5 text-[38px] leading-[1.06] desk:text-[50px]">
            Seu aquário é um{' '}
            <ScriptText bloco className="text-[40px] leading-none desk:text-[52px]">
              ecossistema.
            </ScriptText>
          </h1>
          <p className="mb-7 max-w-[440px] text-base leading-[1.6] text-ink-soft">
            Peixes, plantas e projetos de aquários. A qualidade que você já conhece, agora pertinho de você.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <Button onClick={() => navigate(ROTAS.loja)}>Ver produtos</Button>
            <Button variant="ghost" onClick={() => navigate(ROTAS.primeiroAquario)}>
              Sou iniciante →
            </Button>
          </div>
        </div>

        <div className="flex flex-1 justify-center" data-h="H8 Trocar por foto real">
          <GlowFrame>
            <svg width="300" height="240" viewBox="0 0 300 240" className="max-w-full" aria-hidden="true">
              <ellipse cx="90" cy="110" rx="26" ry="14" fill="#FF7A45" />
              <path d="M116 110 l16 -12 l0 24 z" fill="#FF7A45" />
              <ellipse cx="190" cy="70" rx="18" ry="10" fill="#00C2D6" />
              <path d="M208 70 l12 -9 l0 18 z" fill="#00C2D6" />
              <ellipse cx="150" cy="160" rx="15" ry="8" fill="#FFC93C" />
              <path d="M165 160 l10 -7 l0 14 z" fill="#FFC93C" />
              <circle cx="240" cy="140" r="3" fill="#A64DFF" />
              <circle cx="250" cy="120" r="2" fill="#00C2D6" />
              <circle cx="50" cy="60" r="2.5" fill="#FFC93C" />
            </svg>
          </GlowFrame>
        </div>
      </div>
    </div>
  )
}

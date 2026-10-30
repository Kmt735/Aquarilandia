import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import Highlight from '../atoms/Highlight'
import IlustracaoAquario from '../molecules/IlustracaoAquario'
import useReducedMotion from '../../hooks/useReducedMotion'
import { ROTAS } from '../../utils/rotas'

const BOLHAS = [
  { left: '8%', size: 10, dur: 16, delay: 0 },
  { left: '22%', size: 6, dur: 13, delay: 5 },
  { left: '58%', size: 8, dur: 18, delay: 2 },
  { left: '84%', size: 12, dur: 15, delay: 8 },
]

// Uma mensagem + 2 CTAs (item 29 · atenção). O WhatsApp fica só no botão flutuante.
export default function Hero() {
  const navigate = useNavigate()
  const reduzido = useReducedMotion()

  return (
    <section aria-labelledby="titulo-hero" className="luz-luminaria relative overflow-hidden bg-surface-tint">
      {!reduzido && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {BOLHAS.map((b) => (
            <span
              key={b.left}
              className="absolute -bottom-4 animate-bolha-sobe rounded-full border-2 border-primary-text/40"
              style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
            />
          ))}
        </div>
      )}
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-8 px-4 pt-10 pb-6 sm:px-6 desk:grid-cols-[1.1fr_1fr] desk:gap-12 desk:px-10 desk:pt-16 desk:pb-8">
        <div>
          <Eyebrow>Peixes nacionais e importados</Eyebrow>
          <h1 id="titulo-hero" className="mt-5 mb-4 text-display text-primary-dark dark:text-foreground">
            Seu aquário é um <Highlight>ecossistema.</Highlight>
          </h1>
          <p className="mb-7 max-w-[480px] text-corpo-lg text-text-muted">
            Peixes, plantas e projetos de aquários. A qualidade que você já conhece, agora pertinho de você.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button tamanho="lg" onClick={() => navigate(ROTAS.loja)}>
              Ver produtos
            </Button>
            <Button tamanho="lg" variant="secundario" onClick={() => navigate(ROTAS.primeiroAquario)}>
              Sou iniciante →
            </Button>
          </div>
          <p className="mt-6 flex items-center gap-2 text-pequeno text-text-muted">
            <MapPin aria-hidden="true" className="size-4 text-primary-text" />
            Loja física em São João del Rei/MG
          </p>
        </div>
        <IlustracaoAquario className="mx-auto w-full max-w-[420px] max-sm:hidden desk:max-w-[520px]" />
      </div>
    </section>
  )
}

import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Eyebrow from '../atoms/Eyebrow'
import Highlight from '../atoms/Highlight'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import IlustracaoAquario from '../molecules/IlustracaoAquario'
import useWhatsApp from '../../hooks/useWhatsApp'
import { ROTAS } from '../../utils/rotas'

export default function Hero() {
  const navigate = useNavigate()
  const abrirWhatsApp = useWhatsApp()

  return (
    <section className="bg-surface-tint">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-12 pb-10 sm:px-6 desk:grid-cols-[1fr_1.05fr] desk:gap-14 desk:px-10 desk:pt-16 desk:pb-14">
        <div>
          <Eyebrow>Peixes nacionais e importados</Eyebrow>
          <h1 className="mt-5 mb-5 text-[44px] leading-[1.04] text-primary-dark desk:text-[64px] dark:text-foreground">
            Seu aquário é um <Highlight>ecossistema.</Highlight>
          </h1>
          <p className="mb-8 max-w-[460px] text-[18px] leading-relaxed text-text-muted">
            Peixes, plantas e projetos de aquários. A qualidade que você já conhece, agora pertinho de você.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate(ROTAS.loja)}>Ver produtos</Button>
            <Button variant="ghost" onClick={() => navigate(ROTAS.primeiroAquario)}>
              Sou iniciante →
            </Button>
          </div>
        </div>

        {/* Ilustração no lugar da foto principal, com o atalho do WhatsApp flutuando por cima */}
        <div className="relative mx-auto w-full max-w-[560px] pb-6 desk:pb-0">
          <IlustracaoAquario className="w-full" />
          <button
            type="button"
            onClick={() => abrirWhatsApp()}
            className="absolute bottom-0 left-2 flex items-center gap-3 rounded-card border border-border bg-surface py-2.5 pr-5 pl-2.5 text-left shadow-pop transition-transform duration-200 hover:-translate-y-0.5 sm:left-6 desk:-left-6 desk:bottom-10"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <WhatsAppIcon className="size-5" />
            </span>
            <span className="font-display text-[15.5px] font-extrabold text-primary-dark dark:text-foreground">
              Falar no WhatsApp
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

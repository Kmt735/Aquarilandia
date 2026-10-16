import { Badge } from '@/components/ui/badge'
import Button from '../atoms/Button'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function FutureBanner() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="mx-auto mt-6 mb-20 max-w-[1200px] px-4 sm:px-6 desk:px-10">
      <div className="flex flex-col items-start justify-between gap-5 rounded-card border border-border bg-surface p-7 desk:flex-row desk:items-center desk:p-9">
        <div className="flex flex-col gap-3 text-[16px] sm:flex-row sm:items-center">
          <Badge variant="neon" className="gap-1.5 px-2.5 py-1 text-[11px]">
            <span aria-hidden="true" className="neon-dot size-1.5 rounded-full" />
            Em breve
          </Badge>
          Locação de aquários — manutenção inclusa, sem compromisso de compra.
        </div>
        <Button variant="ghost" onClick={() => abrirWhatsApp('locação de aquários')}>
          Quero saber mais
        </Button>
      </div>
    </div>
  )
}

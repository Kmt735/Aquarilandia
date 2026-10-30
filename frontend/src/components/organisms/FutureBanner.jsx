import { Badge } from '@/components/ui/badge'
import Button from '../atoms/Button'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function FutureBanner() {
  const abrirWhatsApp = useWhatsApp()
  return (
    <div className="mx-auto mb-16 max-w-[1200px] px-4 sm:px-6 desk:px-10">
      <div className="flex flex-col items-start justify-between gap-5 rounded-card border border-dashed border-border-control bg-surface-tint p-6 desk:flex-row desk:items-center desk:p-8">
        <div className="flex flex-col gap-3 text-corpo font-semibold sm:flex-row sm:items-center">
          <Badge variant="accent">Em breve</Badge>
          Locação de aquários — manutenção inclusa, sem compromisso de compra.
        </div>
        <Button variant="secundario" onClick={() => abrirWhatsApp('a locação de aquários')}>
          Quero saber mais
        </Button>
      </div>
    </div>
  )
}

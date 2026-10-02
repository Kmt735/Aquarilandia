import Button from '../atoms/Button'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function FutureBanner() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="mx-auto mt-5 mb-[70px] max-w-[1180px] px-4 desk:px-10">
      <div className="flex flex-col items-start justify-between gap-4 rounded-card bg-ocean px-8 py-7 text-white desk:flex-row desk:items-center">
        <div>
          <span className="mr-3 rounded-full bg-gold px-2.5 py-1 font-mono text-[10px] font-bold text-gold-ink">
            Em breve
          </span>
          Locação de aquários — manutenção inclusa, sem compromisso de compra.
        </div>
        <Button variant="ghost" className="border-white/50!" onClick={() => abrirWhatsApp('locação de aquários')}>
          Quero saber mais
        </Button>
      </div>
    </div>
  )
}

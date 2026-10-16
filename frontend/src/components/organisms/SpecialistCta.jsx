import Button from '../atoms/Button'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function SpecialistCta() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 desk:px-10">
      <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-7 desk:flex-row desk:items-center desk:justify-between desk:p-9">
        <p className="font-display text-[22px] font-semibold tracking-[-0.02em]">Prefere ter alguém te guiando pessoalmente?</p>
        <Button onClick={() => abrirWhatsApp('falar com um especialista')}>Falar com um especialista</Button>
      </div>
    </div>
  )
}

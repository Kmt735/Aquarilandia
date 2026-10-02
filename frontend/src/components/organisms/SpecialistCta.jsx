import Button from '../atoms/Button'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function SpecialistCta() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="px-4 pt-5 pb-[70px] text-center desk:px-10">
      <p className="mb-4 text-sm text-ink-soft">Prefere ter alguém te guiando pessoalmente?</p>
      <Button onClick={() => abrirWhatsApp('falar com um especialista')}>Falar com um especialista</Button>
    </div>
  )
}

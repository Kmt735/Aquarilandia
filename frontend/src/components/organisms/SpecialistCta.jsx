import CtaBanner from '../molecules/CtaBanner'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function SpecialistCta() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <CtaBanner
      titulo="Prefere ter alguém te guiando pessoalmente?"
      acao="Falar com um especialista"
      whatsapp
      onAcao={() => abrirWhatsApp('falar com um especialista')}
      className="pb-20"
    />
  )
}

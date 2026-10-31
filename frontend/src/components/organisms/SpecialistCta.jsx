import Button from '../atoms/Button'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import CtaBanner from '../molecules/CtaBanner'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function SpecialistCta() {
  const { abrirOrcamento } = useUI()
  const abrirWhatsApp = useWhatsApp()
  return (
    <CtaBanner
      titulo="Prefere que a loja monte pra você?"
      texto="A Aquarilândia monta o aquário no seu espaço. Valor sob orçamento."
      acoes={
        <>
          <Button tamanho="lg" onClick={() => abrirOrcamento('Montagem de aquários')}>
            Solicitar orçamento
          </Button>
          <Button
            tamanho="lg"
            variant="secundario"
            className="border-on-primary-dark/60 text-on-primary-dark hover:border-on-primary-dark hover:bg-on-primary-dark/10 hover:text-on-primary-dark"
            onClick={() => abrirWhatsApp('montar meu primeiro aquário')}
          >
            <WhatsAppIcon className="size-[18px]" />
            Tirar dúvida
          </Button>
        </>
      }
      className="pb-16"
    />
  )
}

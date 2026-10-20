import { Button } from '@/components/ui/button'
import WhatsAppIcon from '../icons/WhatsAppIcon'

export default function WhatsAppButton({ label = 'Falar no WhatsApp', className = '', ...props }) {
  return (
    <Button variant="accent" size="icon" aria-label={label} title={label} className={className} {...props}>
      <WhatsAppIcon className="size-[18px]" />
    </Button>
  )
}

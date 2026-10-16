import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function WhatsAppButton({ label = 'Falar no WhatsApp', className = '', ...props }) {
  return (
    <Button variant="outline" size="icon-sm" aria-label={label} title={label} className={className} {...props}>
      <MessageCircle />
    </Button>
  )
}

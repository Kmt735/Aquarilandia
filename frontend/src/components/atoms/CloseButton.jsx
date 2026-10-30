import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CloseButton({ label = 'Fechar', className = '', ...props }) {
  return (
    <Button variant="outline" size="icon" aria-label={label} title={label} className={className} {...props}>
      <X aria-hidden="true" />
    </Button>
  )
}

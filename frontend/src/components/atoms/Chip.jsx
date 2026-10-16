import { Toggle } from '@/components/ui/toggle'

export default function Chip({ children, ativo = false, onClick, ...props }) {
  return (
    <Toggle variant="outline" pressed={ativo} onPressedChange={() => onClick?.()} {...props}>
      {children}
    </Toggle>
  )
}

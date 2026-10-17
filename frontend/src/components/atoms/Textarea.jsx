import { Textarea as UITextarea } from '@/components/ui/textarea'
import { classeCampo } from './campo'

export default function Textarea(props) {
  return <UITextarea className={classeCampo()} {...props} />
}

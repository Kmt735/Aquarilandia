import { classeCampo } from './campo'

export default function Textarea(props) {
  return <textarea className={classeCampo()} {...props} />
}

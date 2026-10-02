import { classeCampo } from './campo'

export default function Input({ estado, className = '', ...props }) {
  return <input className={`${classeCampo(estado)} ${className}`} {...props} />
}

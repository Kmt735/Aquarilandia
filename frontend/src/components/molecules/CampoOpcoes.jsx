import { cn } from '@/lib/utils'
import { classeCampo } from '../atoms/campo'

// <select> nativo com a aparência dos campos do site. Opções no formato [[valor, rótulo], ...]
export default function CampoOpcoes({ id, name, erro, opcoes, placeholder, value, onChange, onBlur, className = '', ...props }) {
  return (
    <select
      id={id}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      onBlur={onBlur}
      aria-invalid={Boolean(erro) || undefined}
      className={cn(classeCampo(erro), 'h-11 w-full border px-3', className)}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opcoes.map(([valor, rotulo]) => (
        <option key={valor} value={valor}>
          {rotulo}
        </option>
      ))}
    </select>
  )
}
import { Check } from 'lucide-react'

// Checkbox nativo (acessível por padrão) com aparência do site. O rótulo vai em `children`.
export default function Checkbox({ id, children, erro, describedBy, checked, onChange, ...props }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-pequeno">
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(checked)}
          onChange={onChange}
          aria-invalid={Boolean(erro) || undefined}
          aria-describedby={describedBy}
          className={`peer size-5 cursor-pointer appearance-none rounded-md border-2 bg-surface transition-colors checked:border-primary checked:bg-primary ${erro ? 'border-danger-text' : 'border-border-control'}`}
          {...props}
        />
        <Check aria-hidden="true" strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-4 text-primary-foreground opacity-0 peer-checked:opacity-100" />
      </span>
      <span>{children}</span>
    </label>
  )
}

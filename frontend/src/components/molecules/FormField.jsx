import { Label } from '@/components/ui/label'

export default function FormField({ id, label, obrigatorio = false, estado, erro, children }) {
  return (
    <div className="mb-4">
      <Label htmlFor={id} className="mb-1.5 text-[13px] font-semibold">
        {label}{' '}
        {obrigatorio ? (
          <span className="text-danger">*</span>
        ) : (
          <span className="font-normal text-text-muted">(opcional)</span>
        )}
      </Label>
      {children}
      {estado === 'erro' && erro && (
        <div role="alert" className="mt-1.5 text-[12.5px] text-danger">
          {erro}
        </div>
      )}
    </div>
  )
}

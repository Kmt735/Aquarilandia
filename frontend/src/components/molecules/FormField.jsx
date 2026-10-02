export default function FormField({ id, label, obrigatorio = false, estado, erro, children }) {
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-bold">
        {label}{' '}
        {obrigatorio ? (
          <span className="text-orange">*</span>
        ) : (
          <span className="font-normal text-ink-soft">(opcional)</span>
        )}
      </label>
      {children}
      {estado === 'erro' && erro && <div className="mt-[5px] text-[11.5px] text-orange">{erro}</div>}
    </div>
  )
}

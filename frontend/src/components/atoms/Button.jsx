const variantes = {
  primary: 'rounded-full bg-gold-grad px-[26px] py-[15px] text-sm font-extrabold text-gold-ink',
  ghost: 'rounded-full border border-[#17474D] bg-transparent px-[26px] py-[15px] text-sm text-white',
  cta: 'rounded-full bg-gold-grad px-5 py-2.5 text-[13px] font-extrabold text-gold-ink',
  buy: 'flex-1 rounded-lg bg-cyan-grad p-2.5 text-xs font-bold text-bg',
  quote: 'rounded-lg bg-gold-grad p-[11px] text-[12.5px] font-extrabold text-gold-ink',
  submit: 'w-full rounded-[10px] bg-gold-grad p-[13px] text-sm font-extrabold text-gold-ink',
  whatsapp: 'w-full rounded-[10px] bg-whats p-[13px] text-sm font-extrabold text-white',
  guide: 'whitespace-nowrap rounded-lg border border-line bg-abyss px-3.5 py-[9px] text-[12.5px] font-bold text-ink',
  guidePrimary:
    'whitespace-nowrap rounded-lg border border-cyan bg-cyan px-3.5 py-[9px] text-[12.5px] font-bold text-bg',
}

export default function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`transition disabled:opacity-35 ${variantes[variant]} ${className}`}
      {...props}
    />
  )
}

export default function Tag({ children, positivo = true, className = '', ...props }) {
  return (
    <span
      className={`rounded-full border border-line bg-abyss px-[9px] py-1 font-mono text-[10px] font-bold ${positivo ? 'text-mint' : 'text-orange'} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

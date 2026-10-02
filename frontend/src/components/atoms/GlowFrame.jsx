export default function GlowFrame({ children, className = '', innerClassName = '' }) {
  return (
    <div className={`rounded-3xl bg-frame p-1.5 ${className}`}>
      <div className={`rounded-[20px] bg-abyss p-3.5 ${innerClassName}`}>{children}</div>
    </div>
  )
}

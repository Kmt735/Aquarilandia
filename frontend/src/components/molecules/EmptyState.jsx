export default function EmptyState({ icone, children, acoes, ...props }) {
  return (
    <div className="mx-auto mb-[60px] max-w-[1180px] px-10 py-9 text-center text-sm leading-[1.6] text-ink-soft" {...props}>
      <div className="mb-2 text-4xl">{icone}</div>
      {children}
      {acoes && <div className="mt-3.5 flex flex-wrap justify-center gap-2.5">{acoes}</div>}
    </div>
  )
}

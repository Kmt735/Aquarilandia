export default function EmptyState({ icone, children, acoes, ...props }) {
  return (
    <div
      className="mx-auto mb-16 max-w-[1200px] rounded-card border border-dashed border-border-strong px-6 py-12 text-center text-[15px] leading-relaxed text-text-muted"
      {...props}
    >
      {icone && (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface-tint text-primary-text [&_svg]:size-6">
          {icone}
        </div>
      )}
      {children}
      {acoes && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{acoes}</div>}
    </div>
  )
}

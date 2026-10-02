import Badge from './Badge'

export default function IconButton({ children, badge, badgeKey = 0, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`relative flex size-10 items-center justify-center rounded-full border border-line bg-panel text-base text-ink hover:border-cyan ${className}`}
      {...props}
    >
      {children}
      {badge !== undefined && (
        <Badge key={badgeKey} animar={badgeKey > 0}>
          {badge}
        </Badge>
      )}
    </button>
  )
}

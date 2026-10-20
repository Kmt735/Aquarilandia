// Aquário no traço do Lucide (24×24, stroke 2) — o Lucide não tem um ícone de aquário
export default function AquarioIcon({ size = 24, strokeWidth = 2, className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="15" rx="2" />
      <path d="M3 8.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
      <path d="M8 13.5c1.2-1.4 3.3-1.4 4.5 0-1.2 1.4-3.3 1.4-4.5 0Z" />
      <path d="m12.5 13.5 2-1.2v2.4Z" />
      <path d="M6 22h12" />
    </svg>
  )
}

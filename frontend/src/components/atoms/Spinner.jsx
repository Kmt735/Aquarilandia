export default function Spinner({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 animate-spin-fast rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

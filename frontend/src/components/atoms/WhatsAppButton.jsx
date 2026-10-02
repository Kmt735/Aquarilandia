export default function WhatsAppButton({ label = 'Falar no WhatsApp', className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`min-h-[34px] w-[38px] rounded-lg bg-whats text-[15px] text-white ${className}`}
      {...props}
    >
      💬
    </button>
  )
}

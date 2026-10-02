export default function WhatsAppFloat({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Falar no WhatsApp"
      aria-label="Falar no WhatsApp"
      className="fixed right-6 bottom-6 z-50 flex size-[54px] items-center justify-center rounded-full bg-whats text-2xl text-white shadow-[0_8px_24px_rgba(0,0,0,.5)]"
    >
      💬
    </button>
  )
}

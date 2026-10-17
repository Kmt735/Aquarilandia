import { MessageCircle } from 'lucide-react'

export default function WhatsAppFloat({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Falar no WhatsApp"
      aria-label="Falar no WhatsApp"
      className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop transition-[background-color,box-shadow] duration-200 hover:bg-primary-hover hover:shadow-neon sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-6" />
    </button>
  )
}

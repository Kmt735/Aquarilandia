import WhatsAppIcon from '../icons/WhatsAppIcon'

export default function WhatsAppFloat({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Falar no WhatsApp"
      aria-label="Falar no WhatsApp"
      className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-pop transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-accent-hover sm:right-6 sm:bottom-6"
    >
      <WhatsAppIcon className="size-7" />
    </button>
  )
}

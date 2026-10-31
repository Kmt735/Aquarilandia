import WhatsAppIcon from '../icons/WhatsAppIcon'

// Único WhatsApp fixo do site (canal de dúvida). Amarelo = atalho persistente, como o carrinho.
export default function WhatsAppFloat({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Tirar dúvida no WhatsApp"
      aria-label="Tirar dúvida no WhatsApp"
      className="fixed right-4 bottom-4 z-(--z-flutuante) flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-pop transition-[background-color,transform,box-shadow] duration-(--dur-media) hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-glow-accent sm:right-6 sm:bottom-6"
    >
      <WhatsAppIcon className="size-7" />
    </button>
  )
}

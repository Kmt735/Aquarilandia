import Toast from '../molecules/Toast'
import useToast from '../../hooks/useToast'

// Região viva: leitores de tela anunciam cada aviso (aria-live). Não bloqueia a página:
// o contêiner deixa os cliques passarem e só os próprios avisos recebem clique.
export default function ToastStack() {
  const { toasts, dispensar } = useToast()

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-(--z-toast) mx-auto flex max-w-[460px] flex-col items-stretch gap-2 sm:bottom-6"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          titulo={t.titulo}
          mensagem={t.mensagem}
          tipo={t.tipo}
          acao={t.acao}
          onFechar={() => dispensar(t.id)}
          onAcao={() => {
            dispensar(t.id)
            t.onAcao?.()
          }}
        />
      ))}
    </div>
  )
}

import Toast from '../molecules/Toast'
import useToast from '../../hooks/useToast'

export default function ToastStack() {
  const { toasts, dispensar } = useToast()

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[92px] left-1/2 z-[400] flex w-max max-w-[92vw] -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          mensagem={t.mensagem}
          acao={t.acao}
          carregando={t.carregando}
          onAcao={() => {
            dispensar(t.id)
            t.onAcao?.()
          }}
        />
      ))}
    </div>
  )
}

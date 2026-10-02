import Button from '../atoms/Button'
import CloseButton from '../atoms/CloseButton'
import ProgressBar from '../atoms/ProgressBar'

// H1 · Progresso visível  ·  H3 · Voltar e sair a qualquer momento
export default function GuideBar({ passo, total, titulo, onVoltar, onAvancar, onSair }) {
  const ultimo = passo === total - 1

  return (
    <div
      className="sticky bottom-4 z-40 mx-4 mb-10 flex items-center gap-3 rounded-[14px] border border-line bg-panel-2 px-4 py-3.5 shadow-[0_12px_30px_rgba(0,0,0,.45)] desk:mx-auto desk:max-w-[680px]"
      data-h="H1 · H3 Progresso, voltar e sair"
    >
      <Button variant="guide" onClick={onVoltar} disabled={passo === 0}>
        ← Voltar
      </Button>
      <div className="min-w-0 flex-1">
        <div className="mb-[7px] truncate text-[12.5px] font-bold">
          Etapa {passo + 1} de {total} · {titulo}
        </div>
        <ProgressBar valor={(passo + 1) / total} />
      </div>
      <Button variant="guidePrimary" onClick={onAvancar}>
        {ultimo ? 'Concluir ✓' : 'Próxima →'}
      </Button>
      <CloseButton label="Sair do guia" onClick={onSair} />
    </div>
  )
}

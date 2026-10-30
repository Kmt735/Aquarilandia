import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Button from '../atoms/Button'
import CloseButton from '../atoms/CloseButton'
import ProgressBar from '../atoms/ProgressBar'

// H1 · progresso visível  ·  H3 · voltar e sair a qualquer momento
export default function GuideBar({ passo, total, titulo, onVoltar, onAvancar, onSair }) {
  const ultimo = passo === total - 1
  return (
    <div role="region" aria-label="Navegação do guia" className="sticky bottom-4 z-(--z-flutuante) mx-4 mb-10 flex items-center gap-2 rounded-2xl border border-primary-text/40 bg-surface-elevated p-2 shadow-glow sm:gap-3 sm:p-3 desk:mx-auto desk:max-w-[720px]">
      <Button variant="secundario" onClick={onVoltar} disabled={passo === 0} aria-label="Etapa anterior">
        <ArrowLeft aria-hidden="true" />
        <span className="max-sm:hidden">Voltar</span>
      </Button>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="mb-1.5 truncate text-legenda font-semibold sm:text-pequeno">
          Etapa {passo + 1} de {total} · {titulo}
        </p>
        <ProgressBar valor={(passo + 1) / total} rotulo="Progresso do guia" />
      </div>
      <Button onClick={onAvancar}>
        {ultimo ? 'Concluir' : 'Próxima'}
        {ultimo ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
      </Button>
      <CloseButton label="Sair do guia" onClick={onSair} />
    </div>
  )
}

import Button from '../atoms/Button'
import { iconeServico } from '@/lib/icones'

// Célula da grade de serviços (bordas compartilhadas). Sem `onOrcamento` vira a versão resumida.
export default function ServiceCard({ servico, onOrcamento }) {
  const Icone = iconeServico[servico.id]
  const icone = Icone && (
    <span className="flex size-11 items-center justify-center rounded-xl bg-surface-tint text-primary-text">
      <Icone aria-hidden="true" className="size-5" />
    </span>
  )

  if (!onOrcamento) {
    return (
      <div className="p-7">
        {icone}
        <h4 className="mt-5 mb-2 text-[18px]">{servico.nome}</h4>
        <p className="text-[14px] leading-normal text-text-muted">{servico.resumo}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-surface p-7 transition-colors hover:bg-surface-tint/60 desk:p-8">
      {icone}
      <h4 className="mt-6 mb-2 text-[19px]">{servico.nome}</h4>
      <p className="mb-6 flex-1 text-[14.5px] leading-relaxed text-text-muted">{servico.descricao}</p>
      <Button variant="guide" className="self-start" onClick={onOrcamento}>
        Solicitar orçamento
      </Button>
    </div>
  )
}

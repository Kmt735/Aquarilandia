import Button from '../atoms/Button'

// Sem `onOrcamento` vira o card resumido da home
export default function ServiceCard({ servico, onOrcamento, marcarHeuristicas = false }) {
  if (!onOrcamento) {
    return (
      <div className="rounded-card border border-line bg-panel p-[26px]">
        <div className="mb-3.5 text-2xl">{servico.icone}</div>
        <h4 className="mb-2 font-display text-base font-bold">{servico.nome}</h4>
        <p className="text-[13px] leading-normal text-ink-soft">{servico.resumo}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-card border border-line bg-panel p-7">
      <div className="mb-4 text-[26px]">{servico.icone}</div>
      <h4 className="mb-2 font-display text-[16.5px] font-bold">{servico.nome}</h4>
      <p className="mb-4 flex-1 text-[13px] leading-[1.55] text-ink-soft">{servico.descricao}</p>
      <Button
        variant="quote"
        onClick={onOrcamento}
        data-h={marcarHeuristicas ? 'H5 · H9 Formulário validado' : undefined}
      >
        Solicitar orçamento
      </Button>
    </div>
  )
}

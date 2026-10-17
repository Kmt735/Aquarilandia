import ServiceCard from '../molecules/ServiceCard'
import useUI from '../../hooks/useUI'
import { servicos } from '../../data/servicos'

// Grade com bordas compartilhadas: no desktop o primeiro serviço ocupa 2 colunas e o último a linha inteira
export default function ServiceGrid() {
  const { abrirOrcamento } = useUI()

  return (
    <div className="mx-auto my-12 max-w-[1200px] px-4 sm:px-6 desk:my-16 desk:px-10">
      <div className="grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 desk:grid-cols-3">
        {servicos.map((servico, i) => (
          <div
            key={servico.id}
            className={`flex bg-surface [&>*]:flex-1 ${i === 0 ? 'desk:col-span-2' : ''} ${i === servicos.length - 1 ? 'desk:col-span-3' : ''}`}
          >
            <ServiceCard servico={servico} onOrcamento={() => abrirOrcamento(servico.nome)} />
          </div>
        ))}
      </div>
    </div>
  )
}

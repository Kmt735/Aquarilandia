import ServiceCard from '../molecules/ServiceCard'
import useUI from '../../hooks/useUI'
import { servicos } from '../../data/servicos'

export default function ServiceGrid() {
  const { abrirOrcamento } = useUI()

  return (
    <div className="mx-auto my-10 grid max-w-[1180px] grid-cols-1 gap-5 px-4 sm:grid-cols-2 desk:grid-cols-3 desk:px-10">
      {servicos.map((servico, i) => (
        <ServiceCard
          key={servico.id}
          servico={servico}
          marcarHeuristicas={i === 0}
          onOrcamento={() => abrirOrcamento(servico.nome)}
        />
      ))}
    </div>
  )
}

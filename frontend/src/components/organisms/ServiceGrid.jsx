import ServiceCard from '../molecules/ServiceCard'
import useUI from '../../hooks/useUI'
import { servicos } from '../../data/servicos'

// Grade simétrica: 1 / 2 / 3 colunas — 6 serviços fecham as linhas sem sobra
export default function ServiceGrid() {
  const { abrirOrcamento } = useUI()
  return (
    <ul className="mx-auto grid max-w-[1200px] gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 desk:grid-cols-3 desk:gap-6 desk:px-10 desk:py-14">
      {servicos.map((servico) => (
        <li key={servico.id}>
          <ServiceCard servico={servico} onOrcamento={() => abrirOrcamento(servico.nome)} />
        </li>
      ))}
    </ul>
  )
}

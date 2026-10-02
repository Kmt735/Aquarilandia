import PeixeCard from '../molecules/PeixeCard'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function FishGrid({ peixes }) {
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="mx-auto mt-7 mb-[60px] grid max-w-[1180px] grid-cols-1 gap-5 px-4 sm:grid-cols-2 desk:grid-cols-3 desk:px-10">
      {peixes.map((peixe, i) => (
        <PeixeCard
          key={peixe.id}
          peixe={peixe}
          marcarHeuristicas={i === 0}
          onWhatsApp={() => abrirWhatsApp(`perguntar sobre ${peixe.nome}`)}
        />
      ))}
    </div>
  )
}

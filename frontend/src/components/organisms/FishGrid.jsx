import PeixeCard from '../molecules/PeixeCard'
import useCart from '../../hooks/useCart'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function FishGrid({ peixes }) {
  const { adicionar } = useCart()
  const abrirWhatsApp = useWhatsApp()

  return (
    <div className="mx-auto mt-8 mb-20 grid max-w-[1200px] grid-cols-1 gap-6 px-4 sm:grid-cols-2 sm:px-6 desk:grid-cols-3 desk:px-10">
      {peixes.map((peixe) => (
        <PeixeCard
          key={peixe.id}
          peixe={peixe}
          onVerificar={() => abrirWhatsApp(`verificar disponibilidade de ${peixe.nome}`)}
          onAdicionar={() => adicionar(peixe)}
        />
      ))}
    </div>
  )
}
import { Fish } from 'lucide-react'
import { useState } from 'react'
import Midia from './Midia'

// Mostra a foto do peixe; se não houver foto (ou ela não carregar), mostra o ícone
export default function FotoPeixe({ peixe, proporcao = '4/3', className = '' }) {
  const [falhou, setFalhou] = useState(false)
  const temFoto = Boolean(peixe.foto) && !falhou

  return (
    <Midia proporcao={proporcao} icone={temFoto ? undefined : Fish} className={className}>
      {temFoto && (
        <img
          src={peixe.foto}
          alt={`Foto de ${peixe.nome}`}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="size-full object-cover"
        />
      )}
    </Midia>
  )
}
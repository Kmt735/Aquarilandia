import { useState } from 'react'
import Imagem from '../atoms/Imagem'

// Galeria com miniaturas. Hoje há no máximo uma foto por item; quando a API mandar várias, as miniaturas aparecem.
export default function Galeria({ imagens, categoria, nome }) {
  const [atual, setAtual] = useState(0)
  const foto = imagens[atual]
  return (
    <div>
      <div className="overflow-hidden rounded-card border border-border-strong">
        <Imagem src={foto?.src} alt={foto?.alt ?? ''} categoria={categoria} />
      </div>
      {imagens.length > 1 && (
        <ul className="mt-3 flex gap-2" aria-label={`Fotos de ${nome}`}>
          {imagens.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setAtual(i)}
                aria-label={`Foto ${i + 1} de ${imagens.length}`}
                aria-current={i === atual}
                className={`block w-16 overflow-hidden rounded-lg border-2 ${i === atual ? 'border-primary-text' : 'border-transparent'}`}
              >
                <Imagem src={img.src} alt="" categoria={categoria} proporcao="1/1" compacta />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

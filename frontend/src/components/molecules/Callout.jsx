import Aviso from './Aviso'

// Destaque dentro do conteúdo do guia: "Dica" (informativo) ou "Atenção" (cuidado)
const TIPOS = {
  dica: { tipo: 'info', titulo: 'Dica' },
  atencao: { tipo: 'aviso', titulo: 'Atenção' },
}

export default function Callout({ tipo = 'dica', children, className }) {
  return (
    <Aviso {...TIPOS[tipo]} className={className}>
      {children}
    </Aviso>
  )
}

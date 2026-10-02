const fundos = {
  coral: 'bg-photo-coral',
  produto: 'bg-photo-produto',
  ouro: 'bg-photo-ouro',
}

// Placeholder de foto com emoji (H8 · trocar por fotos reais)
export default function EmojiPhoto({ children, variante = 'coral', className = '' }) {
  return (
    <div className={`relative flex items-center justify-center ${fundos[variante]} ${className}`}>{children}</div>
  )
}

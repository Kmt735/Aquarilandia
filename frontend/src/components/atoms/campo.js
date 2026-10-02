// Estilo compartilhado por Input, Select e Textarea
export function classeCampo(estado) {
  const borda = estado === 'erro' ? 'border-orange' : estado === 'ok' ? 'border-mint' : 'border-line'
  return `w-full resize-y rounded-[10px] border ${borda} bg-abyss p-3 font-sans text-sm text-ink outline-none focus:border-cyan`
}

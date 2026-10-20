// Estilo compartilhado por Input, Select e Textarea (sobre os campos do shadcn/ui)
export function classeCampo(estado) {
  const borda = estado === 'erro' ? 'border-danger' : estado === 'ok' ? 'border-primary/60' : 'border-border-strong'
  return `rounded-xl bg-surface text-[15px] text-foreground placeholder:text-text-muted ${borda}`
}

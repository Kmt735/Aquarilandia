// Estilo compartilhado por Input, Select e Textarea. Borda --border-control (3:1 nos dois temas).
export function classeCampo(erro) {
  const borda = erro ? 'border-danger-text' : 'border-border-control'
  return `rounded-xl bg-surface text-corpo text-foreground placeholder:text-text-muted ${borda}`
}

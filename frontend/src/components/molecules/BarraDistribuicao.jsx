// Linha de distribuição (ex.: "4 estrelas ▬▬▬ 3 (60%)"). Usar dentro de <ul>.
// O número vem escrito ao lado: a leitura não depende do tamanho da barra (que é decorativa).
// `compacto`: coluna do rótulo mais estreita, para cards estreitos (ex.: resumo na página do produto)
export default function BarraDistribuicao({ rotulo, dica, qtd, total, compacto = false }) {
  const pct = total ? Math.round((qtd / total) * 100) : 0
  return (
    <li className={`grid items-center gap-3 text-pequeno ${compacto ? 'grid-cols-[5.5rem_1fr_4.75rem]' : 'grid-cols-[8.5rem_1fr_4.75rem] sm:grid-cols-[11rem_1fr_4.75rem]'}`}>
      <span className="text-foreground">
        {rotulo}
        {dica && <span className="sr-only"> ({dica})</span>}
      </span>
      <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right text-text-muted tabular-nums">
        {qtd} <span className="text-legenda">({pct}%)</span>
      </span>
    </li>
  )
}

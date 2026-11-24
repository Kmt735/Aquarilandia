import EstrelasExibicao from '../atoms/EstrelasExibicao'

const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Linha curta logo abaixo do título: nota média + quantidade, levando até a seção de avaliações.
// Altura reservada enquanto carrega (sem pulo de layout).
export default function ResumoNotaProduto({ resumo, carregando }) {
  if (carregando) return <div className="mt-2 h-11" aria-hidden="true" />
  const { total, media } = resumo
  return (
    <a
      href="#avaliacoes"
      className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md text-pequeno text-text-muted underline-offset-4 hover:text-primary-text hover:underline"
    >
      {total ? (
        <>
          <EstrelasExibicao nota={media} className="size-4" />
          <span className="font-bold text-foreground tabular-nums">
            {numero.format(media)}
            <span className="sr-only"> de 5</span>
          </span>
          <span>
            ({total} {total === 1 ? 'avaliação' : 'avaliações'})
          </span>
        </>
      ) : (
        <span>Ainda sem avaliações · Seja o primeiro a avaliar</span>
      )}
    </a>
  )
}

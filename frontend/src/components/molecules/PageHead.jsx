import Eyebrow from '../atoms/Eyebrow'

<<<<<<< Updated upstream
export default function PageHead({ eyebrow, titulo }) {
  return (
    <div className="border-b border-border bg-surface-tint">
      <div className="mx-auto max-w-[1200px] px-4 pt-14 pb-12 sm:px-6 desk:px-10 desk:pt-20 desk:pb-14">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-[38px] leading-[1.05] text-primary-dark desk:text-[52px] dark:text-foreground">{titulo}</h1>
=======
// Cabeçalho das páginas internas: trilha (breadcrumb) + H1 + descrição curta
export default function PageHead({ eyebrow, titulo, descricao, trilha, ilustracao, children }) {
  return (
    <div className="luz-luminaria border-b border-border bg-surface-tint">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-10 px-4 pt-8 pb-10 sm:px-6 desk:px-10 desk:pt-12 desk:pb-12">
        <div className="min-w-0 flex-1">
          {trilha && <Trilha itens={trilha} />}
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className={`${eyebrow ? 'mt-4' : ''} text-h1 text-primary-dark dark:text-foreground`}>{titulo}</h1>
          {descricao && <p className="mt-3 max-w-[620px] text-corpo-lg text-text-muted">{descricao}</p>}
          {children}
        </div>
        {ilustracao}
>>>>>>> Stashed changes
      </div>
    </div>
  )
}

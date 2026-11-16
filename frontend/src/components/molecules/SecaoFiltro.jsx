import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

// Uma seção recolhível do painel de filtros (acordeão do shadcn). Fechada, mostra o valor escolhido
// ao lado do título, para o usuário reconhecer o filtro sem precisar abrir (item 6).
export default function SecaoFiltro({ valor, titulo, resumo, children }) {
  return (
    <AccordionItem value={valor} className="border-border">
      <AccordionTrigger className="min-h-11 items-center py-2 text-pequeno font-bold text-foreground hover:no-underline focus-visible:ring-primary-text/50 [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-text-muted">
        <span className="flex min-w-0 flex-col">
          {titulo}
          {resumo && <span className="truncate text-legenda font-normal text-primary-text">{resumo}</span>}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  )
}

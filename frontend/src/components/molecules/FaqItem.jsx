import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function FaqItem({ pergunta, resposta, pendente = false }) {
  return (
    <AccordionItem value={pergunta} className="border-border-strong">
      <AccordionTrigger className="min-h-11 py-4 font-display text-corpo font-bold hover:text-primary-text hover:no-underline">
        {pergunta}
      </AccordionTrigger>
      <AccordionContent className="max-w-[640px] text-corpo text-text-muted">
        {resposta}
        {pendente && <span className="mt-2 block text-legenda font-semibold text-warning-text">Texto a confirmar com a loja.</span>}
      </AccordionContent>
    </AccordionItem>
  )
}

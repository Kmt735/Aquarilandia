import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function FaqItem({ pergunta, resposta, pendente = false }) {
  return (
    <AccordionItem value={pergunta} className="border-border">
      <AccordionTrigger className="py-5 font-display text-[16.5px] font-bold hover:text-primary-text hover:no-underline">
        {pergunta}
      </AccordionTrigger>
      <AccordionContent className="max-w-[640px] text-[14.5px] leading-relaxed text-text-muted">
        {pendente ? <em>{resposta}</em> : resposta}
      </AccordionContent>
    </AccordionItem>
  )
}

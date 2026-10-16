import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function FaqItem({ pergunta, resposta, pendente = false }) {
  return (
    <AccordionItem value={pergunta} className="border-border">
      <AccordionTrigger className="py-5 text-[15.5px] font-semibold hover:text-primary-text hover:no-underline">
        {pergunta}
      </AccordionTrigger>
      <AccordionContent className="max-w-[640px] text-[14.5px] leading-relaxed text-text-muted">
        {pendente ? <em>{resposta}</em> : resposta}
      </AccordionContent>
    </AccordionItem>
  )
}

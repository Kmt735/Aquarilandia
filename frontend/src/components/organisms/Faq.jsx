import FaqItem from '../molecules/FaqItem'
import SectionHead from '../molecules/SectionHead'
import { Accordion } from '@/components/ui/accordion'

export default function Faq({ perguntas }) {
  return (
    <div className="mx-auto mb-14 max-w-[1200px] px-4 sm:px-6 desk:px-10">
      <div className="grid gap-8 border-t border-border pt-14 desk:grid-cols-[1fr_1.6fr] desk:gap-16">
        <SectionHead eyebrow="Ajuda" titulo="Dúvidas frequentes" className="mb-0" />
        <Accordion type="single" collapsible className="border-t border-border">
          {perguntas.map((p) => (
            <FaqItem key={p.pergunta} {...p} />
          ))}
        </Accordion>
      </div>
    </div>
  )
}

import FaqItem from '../molecules/FaqItem'
import SectionHead from '../molecules/SectionHead'
import { Accordion } from '@/components/ui/accordion'

export default function Faq({ perguntas, titulo = 'Dúvidas frequentes', eyebrow = 'Ajuda', link, id = 'titulo-faq' }) {
  return (
    <section aria-labelledby={id} className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 desk:px-10">
      <div className="grid gap-6 border-t border-border-strong pt-12 desk:grid-cols-[1fr_1.6fr] desk:gap-16">
        <SectionHead id={id} eyebrow={eyebrow} titulo={titulo} link={link} className="mb-0 flex-col items-start!" />
        <Accordion type="single" collapsible className="border-t border-border-strong">
          {perguntas.map((p) => (
            <FaqItem key={p.pergunta} {...p} />
          ))}
        </Accordion>
      </div>
    </section>
  )
}

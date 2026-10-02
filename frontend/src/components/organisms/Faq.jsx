import FaqItem from '../molecules/FaqItem'
import SectionHead from '../molecules/SectionHead'

export default function Faq({ perguntas }) {
  return (
    <div className="mx-auto mb-10 max-w-[760px] px-4 desk:px-10" data-h="H10 Dúvidas frequentes">
      <SectionHead eyebrow="Ajuda" titulo="Dúvidas frequentes" className="mb-[18px]" />
      {perguntas.map((p) => (
        <FaqItem key={p.pergunta} {...p} />
      ))}
    </div>
  )
}

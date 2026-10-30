import SectionHead from '../molecules/SectionHead'
import { termos } from '../../data/glossario'

// Glossário do iniciante (itens 2, 10, 32, 35)
export default function Glossario({ ids }) {
  return (
    <section aria-labelledby="titulo-glossario" id="glossario" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 desk:px-10">
      <SectionHead id="titulo-glossario" eyebrow="Glossário" titulo="Palavras do aquarismo, sem complicação" />
      <dl className="grid gap-4 sm:grid-cols-2 desk:grid-cols-3">
        {ids.map((id) => (
          <div key={id} className="rounded-card border border-border-strong bg-surface p-5">
            <dt className="font-display text-h4 font-extrabold text-primary-text">{termos[id].termo}</dt>
            <dd className="mt-1.5 text-pequeno text-text-muted">{termos[id].texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

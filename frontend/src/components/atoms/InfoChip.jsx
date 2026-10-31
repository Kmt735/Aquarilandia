import { Droplets, Fish, Ruler, Tag, Thermometer } from 'lucide-react'

const ICONES = { temperamento: Fish, aquario: Ruler, temperatura: Thermometer, volume: Droplets, capacidade: Droplets, categoria: Tag }

// Dado de compatibilidade no card (até 3 por card) — item 5 · prevenção de erros; item 28
export default function InfoChip({ id, rotulo, titulo }) {
  const Icone = ICONES[id] ?? Tag
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-legenda font-semibold text-foreground">
      <Icone aria-hidden="true" className="size-3.5 text-primary-text" />
      <span className="sr-only">{titulo}: </span>
      {rotulo}
    </li>
  )
}

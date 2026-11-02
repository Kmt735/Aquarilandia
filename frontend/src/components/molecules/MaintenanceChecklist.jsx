import { CalendarDays, CalendarRange, Check, Sun } from 'lucide-react'

const ICONES = { diaria: Sun, semanal: CalendarDays, mensal: CalendarRange }

// Rotina agrupada por frequência. É uma lista de consulta: nada aqui guarda estado.
export default function MaintenanceChecklist({ grupos }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {grupos.map((g) => {
        const Icone = ICONES[g.id]
        return (
          <section key={g.id} aria-labelledby={`rotina-${g.id}`} className="rounded-card border border-border-strong bg-surface p-5">
            <h3 id={`rotina-${g.id}`} className="flex items-center gap-2 text-h4">
              <Icone aria-hidden="true" className="size-5 text-primary-text" />
              {g.titulo}
            </h3>
            <ul className="mt-3 space-y-2.5">
              {g.itens.map((item) => (
                <li key={item} className="flex gap-2.5 text-pequeno text-text-muted">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-text" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

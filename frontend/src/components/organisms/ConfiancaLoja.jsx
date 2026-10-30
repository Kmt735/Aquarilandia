import { Camera, MapPin, ShieldCheck } from 'lucide-react'
import SectionHead from '../molecules/SectionHead'
import { AVISO_PAGAMENTO, redes, unidades } from '../../data/loja'

// Credibilidade com fatos reais (item 26): loja física, endereços, Instagram e pagamento seguro.
// Sem avaliações ou depoimentos inventados.
export default function ConfiancaLoja() {
  const instagram = redes.find((r) => r.nome === 'Instagram')
  return (
    <section aria-labelledby="titulo-confianca" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 desk:px-10 desk:py-20">
      <SectionHead id="titulo-confianca" eyebrow="Quem somos" titulo="Uma loja de verdade, em São João del Rei" />
      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 desk:grid-cols-4 [&>li]:w-[78%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-auto">
        {unidades.map((u) => (
          <li key={u.unidade} className="rounded-card border border-border-strong bg-surface p-5">
            <MapPin aria-hidden="true" className="mb-3 size-6 text-primary-text" />
            <h3 className="text-h4">Unidade {u.unidade}</h3>
            <address className="mt-1 text-pequeno text-text-muted not-italic">
              {u.linhas.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
            <a href={u.mapaUrl} target="_blank" rel="noopener noreferrer" className="alvo-toque mt-2 inline-block text-pequeno font-bold text-primary-text underline underline-offset-4">
              Ver no mapa<span className="sr-only"> (abre em nova aba)</span>
            </a>
          </li>
        ))}
        <li className="rounded-card border border-border-strong bg-surface p-5">
          <Camera aria-hidden="true" className="mb-3 size-6 text-primary-text" />
          <h3 className="text-h4">Instagram</h3>
          <p className="mt-1 text-pequeno text-text-muted">Novidades, peixes que chegaram e aquários montados pela loja.</p>
          <a href={instagram.url} target="_blank" rel="noopener noreferrer" className="alvo-toque mt-2 inline-block text-pequeno font-bold text-primary-text underline underline-offset-4">
            @aquarilandia<span className="sr-only"> no Instagram (abre em nova aba)</span>
          </a>
        </li>
        <li className="rounded-card border border-border-strong bg-surface p-5">
          <ShieldCheck aria-hidden="true" className="mb-3 size-6 text-primary-text" />
          <h3 className="text-h4">Pagamento seguro</h3>
          <p className="mt-1 text-pequeno text-text-muted">{AVISO_PAGAMENTO}</p>
        </li>
      </ul>
    </section>
  )
}

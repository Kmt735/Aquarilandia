import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import Button from '../atoms/Button'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import CtaBanner from '../molecules/CtaBanner'
import { ROLAGEM_GUIA } from '../molecules/GuideStep'
import useWhatsApp from '../../hooks/useWhatsApp'
import { ROTAS } from '../../utils/rotas'

// Fecho do guia: os passos em uma olhada, a loja e o canal de dúvida
export default function GuiaResumo({ passos }) {
  const abrirWhatsApp = useWhatsApp()
  return (
    <section id="resumo" tabIndex={-1} aria-label="Resumo do guia" className={cn('pt-10 pb-4 outline-none', ROLAGEM_GUIA)}>
      <CtaBanner
        eyebrow="Você chegou ao fim do guia"
        titulo="Do zero ao primeiro peixe"
        acoes={
          <div className="flex flex-col gap-3">
            <Button tamanho="lg" asChild>
              <Link to={ROTAS.loja}>Ir para a loja</Link>
            </Button>
            <Button
              tamanho="lg"
              variant="secundario"
              className="border-on-primary-dark/60 text-on-primary-dark hover:border-on-primary-dark hover:bg-on-primary-dark/10 hover:text-on-primary-dark"
              onClick={() => abrirWhatsApp('montar meu primeiro aquário')}
            >
              <WhatsAppIcon className="size-[18px]" />
              Ficou com dúvida? Fala com a gente
            </Button>
          </div>
        }
      >
        <ol className="mt-4 space-y-2">
          {passos.map((p, i) => (
            <li key={p.id} className="flex gap-3 text-pequeno text-on-primary-dark-muted">
              <span aria-hidden="true" className="font-bold text-accent tabular-nums">{i + 1}</span>
              <span>
                <strong className="text-on-primary-dark">{p.titulo}:</strong> {p.resumo}
              </span>
            </li>
          ))}
        </ol>
      </CtaBanner>
    </section>
  )
}

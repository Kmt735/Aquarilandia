import { Link } from 'react-router'
import Button from '../atoms/Button'
import SectionHead from '../molecules/SectionHead'
import ServiceCard from '../molecules/ServiceCard'
import { servicos } from '../../data/servicos'
import useUI from '../../hooks/useUI'
import { ROTAS } from '../../utils/rotas'

// Prévia dos serviços com UMA ação principal na seção (item 29)
export default function ServicesPreview() {
  const { abrirOrcamento } = useUI()
  const destaques = servicos.filter((s) => s.destaque).slice(0, 3)
  if (destaques.length === 0) return null

  return (
    <section aria-labelledby="titulo-servicos" className="bg-surface-tint">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 desk:px-10 desk:py-20">
        <SectionHead
          id="titulo-servicos"
          eyebrow="Serviços"
          titulo="A gente monta e cuida pra você"
          descricao="Montagem, aquários plantados, manutenção e mais. Valor sob orçamento."
        />
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 desk:gap-6">
          {destaques.map((servico) => (
            <li key={servico.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <ServiceCard servico={servico} compacto nivelTitulo={3} />
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button tamanho="lg" onClick={() => abrirOrcamento()}>
            Solicitar orçamento
          </Button>
          <Link to={ROTAS.servicos} className="alvo-toque text-pequeno font-bold text-primary-text underline underline-offset-4">
            Ver os {servicos.length} serviços
          </Link>
        </div>
      </div>
    </section>
  )
}

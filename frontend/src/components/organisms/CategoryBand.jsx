import WaterWave from '../atoms/WaterWave'
import AquariumBackground from '../molecules/AquariumBackground'
import CategoryCard from '../molecules/CategoryCard'
import SectionHead from '../molecules/SectionHead'
import { iconeCategoria } from '@/lib/icones'
import { categoriasDestaque } from '../../data/categorias'
import { ROTAS, urlLoja } from '../../utils/rotas'

<<<<<<< Updated upstream
// Faixa azul de largura total com a superfície de água animada no topo
=======
// Blocos grandes, nesta ordem; o resto vira bloco compacto. Sempre todas as categorias da loja.
const DESTAQUES = ['Peixes', 'Aquários', 'Plantas', 'Filtros']
const ORDEM = [...DESTAQUES.map((nome) => categoriasMenu.find((c) => c.nome === nome)), ...categoriasMenu.filter((c) => !DESTAQUES.includes(c.nome))]

// Espaço de cada bloco na grade em bento (a partir de `md`)
const LUGAR = { Peixes: 'md:col-span-2 md:row-span-2', Filtros: 'md:col-span-2' }

// Só as faixas vazias: acima/ao lado do título e abaixo da grade. Os blocos são opacos e ficam por cima do canvas.
const RAIAS_PEIXES = [
  { top: 10, de: 52, ate: 98 },
  { bottom: 12, de: 0, ate: 100, celular: true },
  { top: 6, de: 0, ate: 100, celular: true },
]

// Todas as categorias da loja em hierarquia: 4 grandes e 8 compactas (itens 8, 23, 39).
// No celular, mostra as 4 grandes e recolhe o resto (item 19 · menos rolagem).
>>>>>>> Stashed changes
export default function CategoryBand() {
  return (
<<<<<<< Updated upstream
    <section className="bg-surface-tint">
      <WaterWave bolhas />
      <div className="bg-primary">
        <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 desk:px-10 desk:pt-4 desk:pb-20">
          <SectionHead
            tom="claro"
            eyebrow="Explore"
            titulo="Categorias de produtos"
            link={{ to: ROTAS.loja, rotulo: 'Ver loja completa →' }}
            className="mb-8 flex-wrap"
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 desk:grid-cols-4">
            {categoriasDestaque.map((c) => (
              <CategoryCard
                key={c.rotulo}
                icone={iconeCategoria[c.categoria]}
                rotulo={c.rotulo}
                to={urlLoja({ categoria: c.categoria })}
              />
            ))}
          </div>
=======
    <section aria-labelledby="titulo-categorias" className="bg-surface-tint">
      <WaterWave />
      <div className="relative overflow-hidden bg-background">
        <AquariumBackground peixes={3} bolhas={4} peixesCelular={2} bolhasCelular={2} raias={RAIAS_PEIXES} />
        <div className="relative mx-auto max-w-[1200px] px-4 pt-7 pb-14 sm:px-6 desk:px-10">
          <SectionHead id="titulo-categorias" eyebrow="Loja" titulo="Encontre pelo que você precisa" link={{ to: ROTAS.loja, rotulo: 'Ver loja completa' }} className="mb-5" />
          <ul id="lista-categorias" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-[9.5rem_9.5rem_5.25rem_5.25rem]">
            {ORDEM.map((c) => {
              const destaque = DESTAQUES.includes(c.nome)
              return (
                <li key={c.nome} className={`${LUGAR[c.nome] ?? ''} ${!destaque && !todas ? 'max-sm:hidden' : ''}`}>
                  <CategoryCard icone={iconeCategoria[c.nome]} rotulo={c.nome} descricao={descricaoCategoria[c.nome]} to={urlCategoria(c.nome)} destaque={destaque} grande={c.nome === 'Peixes'} />
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            aria-expanded={todas}
            aria-controls="lista-categorias"
            onClick={() => setTodas((t) => !t)}
            className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-surface-tint text-pequeno font-bold text-primary-text sm:hidden"
          >
            {todas ? 'Mostrar menos' : 'Ver todas as categorias'}
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${todas ? 'rotate-180' : ''}`} />
          </button>
>>>>>>> Stashed changes
        </div>
      </div>
    </section>
  )
}

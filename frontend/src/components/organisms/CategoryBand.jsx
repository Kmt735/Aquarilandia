import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import WaterWave from '../atoms/WaterWave'
import AquariumBackground from '../molecules/AquariumBackground'
import CategoryCard from '../molecules/CategoryCard'
import SectionHead from '../molecules/SectionHead'
import { iconeCategoria } from '@/lib/icones'
import useCategorias from '../../hooks/useCategorias'
import CategoriasStatus from '../molecules/CategoriasStatus'
import { descricaoCategoria } from '../../data/glossario'
import { ROTAS, urlCategoria } from '../../utils/rotas'

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
export default function CategoryBand() {
  const consultaCategorias = useCategorias()
  const categoriasMenu = consultaCategorias.erro || consultaCategorias.carregando ? [] : (consultaCategorias.dados ?? [])
  const [todas, setTodas] = useState(false)

  return (
    <section aria-labelledby="titulo-categorias" className="bg-surface-tint">
<<<<<<< HEAD
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
=======
      <WaterWave bolhas />
      <div className="bg-background">
        <div className="mx-auto max-w-[1200px] px-4 pt-4 pb-6 sm:px-6 desk:px-10 desk:pb-8">
          <SectionHead id="titulo-categorias" eyebrow="Loja" titulo="Encontre pelo que você precisa" link={{ to: ROTAS.loja, rotulo: 'Ver loja completa' }} />
          <CategoriasStatus {...consultaCategorias} />
          <ul id="lista-categorias" className="grid gap-3 sm:grid-cols-2 desk:grid-cols-4">
            {categoriasMenu.map((c, i) => (
              <li key={c.nome} className={!todas && i >= VISIVEIS_CELULAR ? 'max-sm:hidden' : ''}>
                <CategoryCard icone={iconeCategoria[c.nome] ?? iconeCategoria.Peixes} rotulo={c.nome} descricao={descricaoCategoria[c.nome]} to={urlCategoria(c)} />
              </li>
            ))}
>>>>>>> 1caf4d5779143f4734f2e067ddc967b4ba09ad5d
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
        </div>
      </div>
    </section>
  )
}

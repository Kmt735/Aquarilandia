import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import WaterWave from '../atoms/WaterWave'
import CategoryCard from '../molecules/CategoryCard'
import SectionHead from '../molecules/SectionHead'
import { iconeCategoria } from '@/lib/icones'
import useCategorias from '../../hooks/useCategorias'
import CategoriasStatus from '../molecules/CategoriasStatus'
import { descricaoCategoria } from '../../data/glossario'
import { ROTAS, urlCategoria } from '../../utils/rotas'

const VISIVEIS_CELULAR = 5

// Todas as categorias da loja, cada uma com a linha que explica o termo (itens 2, 22, 32).
// O azul deixou de ser fundo de seção: vira brilho de borda no hover (itens 8, 23, 39).
// No celular, mostra 5 e recolhe o resto (item 19 · menos rolagem).
export default function CategoryBand() {
  const consultaCategorias = useCategorias()
  const categoriasMenu = consultaCategorias.erro || consultaCategorias.carregando ? [] : (consultaCategorias.dados ?? [])
  const [todas, setTodas] = useState(false)

  return (
    <section aria-labelledby="titulo-categorias" className="bg-surface-tint">
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
          </ul>
          <button
            type="button"
            aria-expanded={todas}
            aria-controls="lista-categorias"
            onClick={() => setTodas((t) => !t)}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border-control text-pequeno font-bold text-primary-text sm:hidden"
          >
            {todas ? 'Mostrar menos' : `Ver todas as ${categoriasMenu.length} categorias`}
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${todas ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </section>
  )
}

import { Columns3 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import Button from '../components/atoms/Button'
import Imagem from '../components/atoms/Imagem'
import Preco from '../components/atoms/Preco'
import StatusBadge from '../components/atoms/StatusBadge'
import Termo from '../components/atoms/Termo'
import EmptyState from '../components/molecules/EmptyState'
import PageTemplate from '../components/templates/PageTemplate'
import { encontrarItem } from '../services/catalogo'
import { ROTAS, urlPeixe } from '../utils/rotas'

// Comparação lado a lado de até 3 peixes (item 6 · reconhecer em vez de lembrar; itens 30 e 31)
const LINHAS = [
  { termo: 'tipoAgua', rotulo: 'Tipo de água', ler: (p) => p.ficha.tipoAgua },
  { termo: 'temperatura', rotulo: 'Temperatura', ler: (p) => p.ficha.temperatura },
  { termo: 'ph', rotulo: 'pH', ler: (p) => p.ficha.ph },
  { termo: 'temperamento', rotulo: 'Temperamento', ler: (p) => p.ficha.temperamento },
  { termo: 'aquarioMinimo', rotulo: 'Aquário mínimo', ler: (p) => p.ficha.aquarioMinimo && `${p.ficha.aquarioMinimo} L` },
  { termo: 'tamanhoAdulto', rotulo: 'Tamanho adulto', ler: (p) => p.ficha.tamanhoAdulto },
  { termo: 'dificuldade', rotulo: 'Dificuldade', ler: (p) => p.ficha.dificuldade?.rotulo },
]

export default function CompararPeixesPage() {
  const [params] = useSearchParams()
  const peixes = (params.get('ids') ?? '')
    .split(',')
    .map(encontrarItem)
    .filter((p) => p?.tipo === 'peixe')
    .slice(0, 3)

  return (
    <PageTemplate titulo="Comparar peixes" trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Loja', to: ROTAS.loja }, { rotulo: 'Peixes', to: ROTAS.peixes }, { rotulo: 'Comparar' }]}>
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 desk:px-10">
        {peixes.length < 2 ? (
          <EmptyState icone={<Columns3 />} titulo="Escolha pelo menos 2 peixes" acoes={<Button asChild><Link to={ROTAS.peixes}>Escolher peixes</Link></Button>}>
            Na lista de peixes, marque “Comparar” em até 3 cards.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border-strong">
            <table className="w-full min-w-[560px] border-collapse text-pequeno">
              <caption className="sr-only">Comparação das fichas técnicas</caption>
              <thead>
                <tr>
                  <td className="w-40 border-b border-border p-4" />
                  {peixes.map((p) => (
                    <th key={p.id} scope="col" className="border-b border-l border-border p-4 text-left align-top">
                      <div className="mb-3 overflow-hidden rounded-xl">
                        <Imagem src={p.imagens[0]?.src} alt="" categoria="Peixes" compacta />
                      </div>
                      <Link to={urlPeixe(p.id)} className="font-display text-h4 font-extrabold hover:text-primary-text hover:underline">
                        {p.nome}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Preco valor={p.preco} tamanho="sm" />
                        <StatusBadge tipo={p.disponibilidade} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LINHAS.map((l) => (
                  <tr key={l.termo} className="even:bg-surface-tint">
                    <th scope="row" className="p-4 text-left font-semibold text-text-muted">
                      <Termo id={l.termo}>{l.rotulo}</Termo>
                    </th>
                    {peixes.map((p) => (
                      <td key={p.id} className="border-l border-border p-4 font-semibold">
                        {l.ler(p) ?? <span className="font-normal text-text-muted">— a confirmar com a loja</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="p-4 text-left font-semibold text-text-muted">
                    Combina com
                  </th>
                  {peixes.map((p) => (
                    <td key={p.id} className="border-l border-border p-4">
                      {p.combinaCom.join(', ') || '—'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-surface-tint">
                  <th scope="row" className="p-4 text-left font-semibold text-text-muted">
                    Evite com
                  </th>
                  {peixes.map((p) => (
                    <td key={p.id} className="border-l border-border p-4">
                      {p.evitarCom.join(', ') || '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTemplate>
  )
}

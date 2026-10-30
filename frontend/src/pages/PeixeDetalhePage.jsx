import { Ban, Droplets, Fish, HeartHandshake, Ruler } from 'lucide-react'
import { Link, useParams } from 'react-router'
import Button from '../components/atoms/Button'
import Skeleton from '../components/atoms/Skeleton'
import Termo from '../components/atoms/Termo'
import EmptyState from '../components/molecules/EmptyState'
import Galeria from '../components/molecules/Galeria'
import { Trilha } from '../components/molecules/PageHead'
import CaixaCompra from '../components/organisms/CaixaCompra'
import useConsulta from '../hooks/useConsulta'
import useTituloPagina from '../hooks/useTituloPagina'
import { obterPeixe } from '../services/catalogo'
import { ROTAS } from '../utils/rotas'

const SEM_DADO = (
  <span className="text-text-muted">
    — <span className="text-legenda">a confirmar com a loja</span>
  </span>
)

// Ficha agrupada por tema (itens 30, 37) com cada termo explicado (itens 2, 32)
function GrupoFicha({ titulo, Icone, linhas }) {
  const visiveis = linhas.filter((l) => l.mostrar !== false)
  return (
    <section aria-labelledby={`grupo-${titulo}`} className="rounded-card border border-border-strong bg-surface p-5">
      <h3 id={`grupo-${titulo}`} className="mb-3 flex items-center gap-2 text-h4">
        <Icone aria-hidden="true" className="size-5 text-primary-text" />
        {titulo}
      </h3>
      <dl className="flex flex-col divide-y divide-border">
        {visiveis.map((l) => (
          <div key={l.termo} className="flex items-center justify-between gap-4 py-2.5 text-pequeno">
            <dt className="text-text-muted">
              <Termo id={l.termo}>{l.rotulo}</Termo>
            </dt>
            <dd className="text-right font-semibold">{l.valor ?? SEM_DADO}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ListaCompat({ titulo, Icone, itens, tom }) {
  return (
    <div className={`rounded-card border p-5 ${tom === 'evite' ? 'border-warning-text/40 bg-warning-soft' : 'border-success-text/40 bg-success-soft'}`}>
      <h3 className="mb-3 flex items-center gap-2 text-h4">
        <Icone aria-hidden="true" className={`size-5 ${tom === 'evite' ? 'text-warning-text' : 'text-success-text'}`} />
        {titulo}
      </h3>
      {itens.length ? (
        <ul className="flex flex-wrap gap-2">
          {itens.map((nome) => (
            <li key={nome}>
              <Link
                to={`${ROTAS.peixes}?busca=${encodeURIComponent(nome)}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border-control bg-surface px-3 text-pequeno font-semibold hover:border-primary-text hover:text-primary-text"
              >
                {nome}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-pequeno text-text-muted">Sem informação ainda. Na dúvida, pergunte à loja antes de juntar espécies.</p>
      )}
    </div>
  )
}

export default function PeixeDetalhePage() {
  const { id } = useParams()
  const { dados: peixe, carregando, erro, recarregar } = useConsulta(() => obterPeixe(id), [id])
  useTituloPagina(peixe?.nome ?? (erro ? 'Peixe não encontrado' : 'Peixe'))

  const trilha = [{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Peixes', to: ROTAS.peixes }, { rotulo: peixe?.nome ?? '…' }]

  if (carregando) {
    return (
      <div aria-busy="true" className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 desk:grid-cols-2 desk:px-10">
        <span className="sr-only">Carregando a ficha do peixe…</span>
        <Skeleton className="aspect-[4/3] rounded-card" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 desk:px-10">
        <h1 className="sr-only">Peixe não encontrado</h1>
        <EmptyState
          tom={erro.status === 404 ? 'vazio' : 'erro'}
          icone={<Fish />}
          titulo={erro.status === 404 ? 'Não encontramos esse peixe' : 'Não conseguimos carregar a ficha'}
          acoes={
            erro.status === 404 ? (
              <Button asChild>
                <Link to={ROTAS.peixes}>Ver todos os peixes</Link>
              </Button>
            ) : (
              <Button onClick={recarregar}>Tentar de novo</Button>
            )
          }
        >
          {erro.status === 404 ? 'Ele pode ter saído do catálogo. Veja os peixes disponíveis agora.' : 'Confira sua conexão e tente de novo.'}
        </EmptyState>
      </div>
    )
  }

  const { ficha } = peixe

  return (
    <article className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 desk:px-10 desk:py-12">
      <Trilha itens={trilha} />

      <div className="grid items-start gap-8 desk:grid-cols-[1.05fr_1fr] desk:gap-12">
        <div className="desk:sticky desk:top-24">
          <Galeria imagens={peixe.imagens} categoria="Peixes" nome={peixe.nome} />
        </div>

        <div>
          <h1 className="text-h1 text-primary-dark dark:text-foreground">{peixe.nome}</h1>
          <p className="mt-1 text-corpo-lg text-text-muted italic">{peixe.cientifico}</p>

          {ficha.aquarioMinimo && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary-text/40 bg-primary-soft px-3 py-2 text-pequeno font-semibold text-foreground">
              <Ruler aria-hidden="true" className="size-4 text-primary-text" />
              Precisa de um aquário de pelo menos <strong className="text-primary-text">{ficha.aquarioMinimo} litros</strong>
            </p>
          )}

          <p className="mt-5 max-w-[60ch] text-corpo text-text-muted">{peixe.descricao}</p>

          <div className="mt-6">
            <CaixaCompra item={peixe} />
          </div>
        </div>
      </div>

      <section aria-labelledby="titulo-ficha" className="mt-12">
        <h2 id="titulo-ficha" className="mb-1 text-h2">
          Ficha técnica
        </h2>
        <p className="mb-5 text-pequeno text-text-muted">Toque no ícone de ajuda ao lado de cada termo para ver o que ele significa.</p>
        <div className="grid gap-4 desk:grid-cols-3">
          <GrupoFicha
            titulo="Água"
            Icone={Droplets}
            linhas={[
              { termo: 'tipoAgua', rotulo: 'Tipo de água', valor: ficha.tipoAgua },
              { termo: 'temperatura', rotulo: 'Temperatura', valor: ficha.temperatura },
              { termo: 'ph', rotulo: 'pH', valor: ficha.ph },
            ]}
          />
          <GrupoFicha
            titulo="Comportamento"
            Icone={Fish}
            linhas={[
              { termo: 'temperamento', rotulo: 'Temperamento', valor: ficha.temperamento },
              { termo: 'tamanhoAdulto', rotulo: 'Tamanho adulto', valor: ficha.tamanhoAdulto },
            ]}
          />
          <GrupoFicha
            titulo="Aquário"
            Icone={Ruler}
            linhas={[
              { termo: 'aquarioMinimo', rotulo: 'Aquário mínimo', valor: ficha.aquarioMinimo && `${ficha.aquarioMinimo} L` },
              { termo: 'dificuldade', rotulo: 'Dificuldade', valor: ficha.dificuldade?.rotulo },
            ]}
          />
        </div>
        {ficha.cores && (
          <p className="mt-4 text-pequeno">
            <span className="text-text-muted">Cores: </span>
            {ficha.cores}
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-compat" className="mt-12">
        <h2 id="titulo-compat" className="mb-1 text-h2">
          Convivência no aquário
        </h2>
        <p className="mb-5 text-pequeno text-text-muted">Antes de juntar espécies, confira com quem esse peixe combina.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ListaCompat titulo="Combina com" Icone={HeartHandshake} itens={peixe.combinaCom} tom="combina" />
          <ListaCompat titulo="Evite com" Icone={Ban} itens={peixe.evitarCom} tom="evite" />
        </div>
      </section>
    </article>
  )
}

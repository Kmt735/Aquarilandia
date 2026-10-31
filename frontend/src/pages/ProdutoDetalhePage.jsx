import { Package } from 'lucide-react'
import { Link, useParams } from 'react-router'
import Button from '../components/atoms/Button'
import Skeleton from '../components/atoms/Skeleton'
import EmptyState from '../components/molecules/EmptyState'
import Galeria from '../components/molecules/Galeria'
import { Trilha } from '../components/molecules/PageHead'
import CaixaCompra from '../components/organisms/CaixaCompra'
import { descricaoCategoria } from '../data/glossario'
import useConsulta from '../hooks/useConsulta'
import useTituloPagina from '../hooks/useTituloPagina'
import { linhasFicha } from '../services/catalogo-mapeamento'
import { obterProduto } from '../services/catalogo'
import { ROTAS, urlLoja } from '../utils/rotas'

// Detalhe de produto (rota nova /loja/:id): o card inteiro da loja abre aqui (item 34)
export default function ProdutoDetalhePage() {
  const { id } = useParams()
  const { dados: produto, carregando, erro, recarregar } = useConsulta(() => obterProduto(id), [id])
  useTituloPagina(produto?.nome ?? (erro ? 'Produto não encontrado' : 'Produto'))

  if (carregando) {
    return (
      <div aria-busy="true" className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 desk:grid-cols-2 desk:px-10">
        <span className="sr-only">Carregando o produto…</span>
        <Skeleton className="aspect-[4/3] rounded-card" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 desk:px-10">
        <h1 className="sr-only">Produto não encontrado</h1>
        <EmptyState
          tom={[400, 404].includes(erro.status) ? 'vazio' : 'erro'}
          icone={<Package />}
          titulo={[400, 404].includes(erro.status) ? 'Não encontramos esse produto' : 'Não conseguimos carregar o produto'}
          acoes={[400, 404].includes(erro.status) ? <Button asChild><Link to={ROTAS.loja}>Ver a loja</Link></Button> : <Button onClick={recarregar}>Tentar de novo</Button>}
        >
          {[400, 404].includes(erro.status) ? 'Ele pode ter saído do catálogo.' : 'Confira sua conexão e tente de novo.'}
        </EmptyState>
      </div>
    )
  }

  const dados = [
    ['Categoria', produto.categoria],
    produto.marca && ['Marca', produto.marca],
    ...linhasFicha(produto.fichaTecnica),
  ].filter(Boolean)

  return (
    <article className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 desk:px-10 desk:py-12">
      <Trilha itens={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Loja', to: ROTAS.loja }, { rotulo: produto.categoria, to: urlLoja({ categoria: produto.categoriaSlug }) }, { rotulo: produto.nome }]} />
      <div className="grid items-start gap-8 desk:grid-cols-[1.05fr_1fr] desk:gap-12">
        <div className="desk:sticky desk:top-24">
          <Galeria imagens={produto.imagens} categoria={produto.categoria} nome={produto.nome} />
        </div>
        <div>
          <h1 className="text-h1 text-primary-dark dark:text-foreground">{produto.nome}</h1>
          <p className="mt-4 max-w-[60ch] text-corpo text-text-muted">{produto.descricao ?? 'Descrição ainda não disponível.'}</p>
          <dl className="mt-5 flex flex-col divide-y divide-border rounded-card border border-border-strong bg-surface px-5 py-2">
            {dados.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5 text-pequeno">
                <dt className="text-text-muted">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {!produto.fichaTecnica && <p className="mt-3 text-pequeno text-text-muted">Ficha técnica ainda não disponível.</p>}
          <p className="mt-2 text-legenda text-text-muted">{descricaoCategoria[produto.categoria]}</p>
          <div className="mt-6">
            <CaixaCompra item={produto} />
          </div>
        </div>
      </div>
    </article>
  )
}

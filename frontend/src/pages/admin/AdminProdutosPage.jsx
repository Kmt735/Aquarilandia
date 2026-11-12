import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import Button from '../../components/atoms/Button'
import Preco from '../../components/atoms/Preco'
import Skeleton from '../../components/atoms/Skeleton'
import StatusBadge from '../../components/atoms/StatusBadge'
import EmptyState from '../../components/molecules/EmptyState'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import Paginacao from '../../components/molecules/Paginacao'
import { Badge } from '@/components/ui/badge'
import useConsulta from '../../hooks/useConsulta'
import useToast from '../../hooks/useToast'
import { listarProdutosAdmin, reativarProduto } from '../../services/admin'
import { plural } from '../../utils/format'

const SITUACOES = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativos', rotulo: 'Ativos' },
  { valor: 'inativos', rotulo: 'Inativos' },
]

export default function AdminProdutosPage() {
  const { toast } = useToast()
  const [situacao, setSituacao] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [reativando, setReativando] = useState(null)
  const { dados, carregando, erro, recarregar } = useConsulta(
    () => listarProdutosAdmin({ situacao, pagina }),
    [situacao, pagina],
  )

  const mudarSituacao = (valor) => {
    setSituacao(valor)
    setPagina(1)
  }

  const reativar = async (produto) => {
    setReativando(produto.id)
    try {
      await reativarProduto(produto.id)
      toast(`“${produto.nome}” voltou a ficar ativo.`, { tipo: 'sucesso' })
      recarregar()
    } catch (e) {
      toast(e.message ?? 'Não foi possível reativar agora. Tente de novo.', { tipo: 'erro' })
    } finally {
      setReativando(null)
    }
  }

  const itens = dados?.itens ?? []

  return (
    <section aria-labelledby="titulo-produtos">
      <h2 id="titulo-produtos" className="mb-2 text-h3">
        Produtos
      </h2>
      <p className="mb-5 text-pequeno text-text-muted" aria-live="polite">
        {dados ? plural(dados.total, 'produto') : 'Carregando…'}
      </p>

      <div role="group" aria-label="Filtrar por situação" className="mb-5 flex flex-wrap gap-2">
        {SITUACOES.map((s) => (
          <button
            key={s.valor}
            type="button"
            aria-pressed={situacao === s.valor}
            onClick={() => mudarSituacao(s.valor)}
            className={`alvo-toque inline-flex h-11 items-center rounded-full px-4 text-pequeno font-bold transition-colors ${situacao === s.valor ? 'bg-primary text-primary-foreground' : 'border border-border-control hover:border-primary-text hover:text-primary-text'}`}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {carregando && (
        <div aria-busy="true" className="grid gap-2">
          <span className="sr-only">Carregando produtos…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {erro && <ErroCompacto onTentar={recarregar}>{erro.message}</ErroCompacto>}

      {!carregando && !erro && itens.length === 0 && (
        <EmptyState titulo="Nenhum produto nesta situação">Tente outro filtro.</EmptyState>
      )}

      {!carregando && !erro && itens.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border-strong">
          <table className="w-full min-w-[680px] text-left text-pequeno">
            <caption className="sr-only">Produtos da loja, ativos e inativos</caption>
            <thead className="bg-surface-tint text-legenda text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Produto</th>
                <th scope="col" className="px-4 py-3 font-bold">Preço</th>
                <th scope="col" className="px-4 py-3 font-bold">Estoque</th>
                <th scope="col" className="px-4 py-3 font-bold">Situação</th>
                <th scope="col" className="px-4 py-3 font-bold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-bold">{p.nome}</div>
                    <div className="text-legenda text-text-muted">{p.categoria}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Preco valor={p.preco} centavos tamanho="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tipo={p.emEstoque ? 'disponivel' : 'esgotado'} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.ativo ? 'sucesso' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {p.ativo ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <Button
                        variant="secundario"
                        tamanho="sm"
                        disabled={reativando === p.id}
                        onClick={() => reativar(p)}
                      >
                        <RotateCw aria-hidden="true" />
                        {reativando === p.id ? 'Reativando…' : 'Reativar'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados && <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas} onMudar={setPagina} />}
    </section>
  )
}
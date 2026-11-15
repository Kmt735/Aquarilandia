import { Pencil, Plus, Power, RotateCw, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Preco from '../../components/atoms/Preco'
import Skeleton from '../../components/atoms/Skeleton'
import StatusBadge from '../../components/atoms/StatusBadge'
import Aviso from '../../components/molecules/Aviso'
import CampoOpcoes from '../../components/molecules/CampoOpcoes'
import EmptyState from '../../components/molecules/EmptyState'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import Paginacao from '../../components/molecules/Paginacao'
import { Badge } from '@/components/ui/badge'
import useConsulta from '../../hooks/useConsulta'
import useToast from '../../hooks/useToast'
import { desativarItem, listarCatalogoAdmin, reativarItem } from '../../services/admin'
import { listarCategorias } from '../../services/catalogo'
import { plural } from '../../utils/format'
import { ROTAS, urlEditarItem } from '../../utils/rotas'

const SITUACOES = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativos', rotulo: 'Na loja' },
  { valor: 'inativos', rotulo: 'Fora da loja' },
]

export default function AdminProdutosPage() {
  const { toast } = useToast()
  const [situacao, setSituacao] = useState('todos')
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(1)
  const [confirmando, setConfirmando] = useState(null)
  const [ocupado, setOcupado] = useState(null)

  const categorias = useConsulta(listarCategorias, [])
  const { dados, carregando, erro, recarregar } = useConsulta(
    () => listarCatalogoAdmin({ situacao, categoria, busca: termo, pagina }),
    [situacao, categoria, termo, pagina],
  )

  const nomesCategoria = Object.fromEntries((categorias.dados ?? []).map((c) => [c.slug, c.nome]))
  const itens = dados?.itens ?? []

  const filtrar = (mudanca) => {
    mudanca()
    setPagina(1)
  }

  const alterarSituacao = async (item, acao) => {
    setOcupado(item.id)
    try {
      if (acao === 'desativar') await desativarItem(item.id)
      else await reativarItem(item.id)
      toast(acao === 'desativar' ? `“${item.nome}” saiu da loja.` : `“${item.nome}” voltou para a loja.`, { tipo: 'sucesso' })
      setConfirmando(null)
      recarregar()
    } catch (e) {
      toast(e.erro ?? 'Não foi possível concluir agora. Tente de novo.', { tipo: 'erro' })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section aria-labelledby="titulo-produtos">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-produtos" className="text-h3">
            Peixes e produtos
          </h2>
          <p className="mt-1 text-pequeno text-text-muted" aria-live="polite">
            {dados ? plural(dados.total, 'item', 'itens') : 'Carregando…'}
          </p>
        </div>
        <Button asChild>
          <Link to={ROTAS.adminNovoItem}>
            <Plus aria-hidden="true" />
            Novo item
          </Link>
        </Button>
      </div>

      <Aviso tipo="info" className="mb-5">
        Para esconder um item da loja, use <strong>Tirar da loja</strong>. A quantidade em estoque ainda não pode ser alterada
        por aqui, porque o servidor ainda não tem essa operação.
      </Aviso>

      <div className="mb-5 grid gap-3 sm:grid-cols-[auto_1fr]">
        <CampoOpcoes
          id="admin-categoria"
          aria-label="Filtrar por categoria"
          placeholder="Todas as categorias"
          opcoes={(categorias.dados ?? []).map((c) => [c.slug, c.nome])}
          value={categoria}
          onChange={(e) => filtrar(() => setCategoria(e.target.value))}
          className="sm:w-64"
        />
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            filtrar(() => setTermo(busca.trim()))
          }}
        >
          <label htmlFor="admin-busca" className="sr-only">
            Buscar por nome
          </label>
          <Input id="admin-busca" type="search" placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} className="min-w-0 flex-1" />
          <Button type="submit" variant="secundario">
            <Search aria-hidden="true" />
            Buscar
          </Button>
        </form>
      </div>

      <div role="group" aria-label="Filtrar por situação" className="mb-5 flex flex-wrap gap-2">
        {SITUACOES.map((s) => (
          <button
            key={s.valor}
            type="button"
            aria-pressed={situacao === s.valor}
            onClick={() => filtrar(() => setSituacao(s.valor))}
            className={`alvo-toque inline-flex h-11 items-center rounded-full px-4 text-pequeno font-bold transition-colors ${situacao === s.valor ? 'bg-primary text-primary-foreground' : 'border border-border-control hover:border-primary-text hover:text-primary-text'}`}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {carregando && (
        <div aria-busy="true" className="grid gap-2">
          <span className="sr-only">Carregando itens…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {erro && <ErroCompacto onTentar={recarregar}>{erro.message}</ErroCompacto>}

      {!carregando && !erro && itens.length === 0 && (
        <EmptyState titulo="Nenhum item encontrado">Tente outro filtro ou cadastre um item novo.</EmptyState>
      )}

      {!carregando && !erro && itens.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border-strong">
          <table className="w-full min-w-[820px] text-left text-pequeno">
            <caption className="sr-only">Peixes e produtos da loja</caption>
            <thead className="bg-surface-tint text-legenda text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Item</th>
                <th scope="col" className="px-4 py-3 font-bold">Preço</th>
                <th scope="col" className="px-4 py-3 font-bold">Na loja</th>
                <th scope="col" className="px-4 py-3 font-bold">Estoque</th>
                <th scope="col" className="px-4 py-3 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-bold">{p.nome}</div>
                    <div className="text-legenda text-text-muted">{nomesCategoria[p.categoria] ?? p.categoria}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Preco valor={p.preco} centavos tamanho="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.ativo ? 'sucesso' : 'secondary'}>{p.ativo ? 'Na loja' : 'Fora da loja'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tipo={p.emEstoque ? 'disponivel' : 'esgotado'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.ativo ? (
                        <Button variant="secundario" tamanho="sm" asChild>
                          <Link to={urlEditarItem(p.id)}>
                            <Pencil aria-hidden="true" />
                            Editar
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="secundario" tamanho="sm" disabled title="Coloque o item de volta na loja para poder editar">
                          <Pencil aria-hidden="true" />
                          Editar
                        </Button>
                      )}

                      {confirmando === p.id ? (
                        <>
                          <span className="text-legenda text-text-muted">Tirar da loja?</span>
                          <Button variant="perigo" tamanho="sm" disabled={ocupado === p.id} onClick={() => alterarSituacao(p, 'desativar')}>
                            {ocupado === p.id ? 'Tirando…' : 'Confirmar'}
                          </Button>
                          <Button variant="terciario" tamanho="sm" onClick={() => setConfirmando(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : p.ativo ? (
                        <Button variant="terciario" tamanho="sm" onClick={() => setConfirmando(p.id)}>
                          <Power aria-hidden="true" />
                          Tirar da loja
                        </Button>
                      ) : (
                        <Button variant="terciario" tamanho="sm" disabled={ocupado === p.id} onClick={() => alterarSituacao(p, 'reativar')}>
                          <RotateCw aria-hidden="true" />
                          {ocupado === p.id ? 'Colocando…' : 'Colocar na loja'}
                        </Button>
                      )}
                    </div>
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
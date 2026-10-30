import { MapPinHouse, Plus } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import Button from '../../components/atoms/Button'
import Skeleton from '../../components/atoms/Skeleton'
import EmptyState from '../../components/molecules/EmptyState'
import FormEndereco from '../../components/organisms/FormEndereco'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import useToast from '../../hooks/useToast'
import { listarEnderecos, removerEndereco, salvarEndereco, tornarPrincipal } from '../../services/conta'
import { textoEndereco } from '../../utils/endereco'

export default function EnderecosPage() {
  useTituloPagina('Endereços')
  const { dados, carregando } = useConsulta(listarEnderecos)
  const [lista, setLista] = useState(null)
  const [editando, setEditando] = useState(null) // null | 'novo' | endereço
  const { toast } = useToast()
  const enderecos = lista ?? dados ?? []

  const salvar = async (valores) => {
    setLista(await salvarEndereco(editando === 'novo' ? valores : { ...editando, ...valores }))
    setEditando(null)
    toast('Endereço salvo.', { tipo: 'sucesso' })
  }

  return (
    <section aria-labelledby="titulo-enderecos">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-enderecos" className="text-h2">
          Endereços
        </h2>
        {!editando && (
          <Button onClick={() => setEditando('novo')}>
            <Plus aria-hidden="true" />
            Adicionar endereço
          </Button>
        )}
      </div>

      {editando && (
        <div className="mb-6">
          <FormEndereco inicial={editando === 'novo' ? undefined : editando} onSalvar={salvar} onCancelar={() => setEditando(null)} />
        </div>
      )}

      {carregando ? (
        <Skeleton className="h-32 rounded-card" />
      ) : enderecos.length === 0 ? (
        <EmptyState icone={<MapPinHouse />} titulo="Nenhum endereço salvo">
          Salve um endereço para finalizar as próximas compras mais rápido.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 desk:grid-cols-2">
          {enderecos.map((e) => (
            <li key={e.id} className={`rounded-card border bg-surface p-5 ${e.principal ? 'border-primary-text/60 shadow-glow' : 'border-border-strong'}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="font-display text-h4 font-extrabold">{e.apelido || 'Endereço'}</p>
                {e.principal && <Badge variant="info">Principal</Badge>}
              </div>
              <p className="text-pequeno text-text-muted">{textoEndereco(e)}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button variant="terciario" tamanho="sm" onClick={() => setEditando(e)}>
                  Editar
                </Button>
                {!e.principal && (
                  <Button variant="terciario" tamanho="sm" onClick={async () => setLista(await tornarPrincipal(e.id))}>
                    Tornar principal
                  </Button>
                )}
                <Button
                  variant="terciario"
                  tamanho="sm"
                  className="text-danger-text"
                  onClick={async () => {
                    setLista(await removerEndereco(e.id))
                    toast('Endereço removido.', { tipo: 'info' })
                  }}
                >
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

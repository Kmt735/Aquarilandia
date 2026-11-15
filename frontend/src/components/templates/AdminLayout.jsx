import { LogOut } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import Button from '../atoms/Button'
import PageHead from '../molecules/PageHead'
import { Badge } from '@/components/ui/badge'
import useAuth from '../../hooks/useAuth'
import usePedidosNovos from '../../hooks/usePedidosNovos'
import useTituloPagina from '../../hooks/useTituloPagina'
import useToast from '../../hooks/useToast'
import { ROTAS } from '../../utils/rotas'

const ABAS = [
  { id: 'resumo', to: ROTAS.admin, rotulo: 'Resumo', end: true },
  { id: 'catalogo', to: ROTAS.adminProdutos, rotulo: 'Peixes e produtos' },
  { id: 'pedidos', to: ROTAS.adminPedidos, rotulo: 'Pedidos' },
]

// Área do administrador. Esta tela só esconde o painel de quem não é admin:
// quem protege os dados de verdade é o servidor (autenticar + exigirAdmin).
export default function AdminLayout() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  useTituloPagina('Painel do administrador')

  if (!usuario) return <Navigate to={`${ROTAS.entrar}?voltar=${encodeURIComponent(pathname)}`} replace />
  if (usuario.papel !== 'admin') return <Navigate to={ROTAS.inicio} replace />
  return <PainelAdmin usuario={usuario} />
}

// Separado para a conferência de pedidos só rodar para quem é administrador
function PainelAdmin({ usuario }) {
  const { sair } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { novos } = usePedidosNovos()

  return (
    <>
      <PageHead
        titulo="Painel do administrador"
        descricao={`Olá, ${usuario.nome.split(' ')[0]}! Aqui você cuida dos pedidos e do que a loja vende.`}
        trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Administração' }]}
      >
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Seções do painel">
            <ul className="flex flex-wrap gap-2">
              {ABAS.map((aba) => (
                <li key={aba.id}>
                  <NavLink
                    to={aba.to}
                    end={aba.end}
                    className={({ isActive }) =>
                      `inline-flex h-11 items-center rounded-full px-4 text-pequeno font-bold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'border border-border-control hover:border-primary-text hover:text-primary-text'}`
                    }
                  >
                    {aba.rotulo}
                    {aba.id === 'pedidos' && novos > 0 && (
                      <>
                        <Badge variant="destructive" className="ml-2 px-1.5">
                          {novos}
                        </Badge>
                        <span className="sr-only"> pedidos novos</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Button
            variant="terciario"
            onClick={async () => {
              await sair()
              toast('Você saiu da sua conta.', { tipo: 'info' })
              navigate(ROTAS.inicio)
            }}
          >
            <LogOut aria-hidden="true" />
            Sair
          </Button>
        </div>
      </PageHead>
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 desk:px-10">
        <Outlet />
      </div>
    </>
  )
}
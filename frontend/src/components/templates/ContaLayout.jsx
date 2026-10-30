import { LogOut } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import Button from '../atoms/Button'
import PageHead from '../molecules/PageHead'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import { ROTAS } from '../../utils/rotas'

const ABAS = [
  { to: ROTAS.minhaConta, rotulo: 'Minhas compras', end: false, compras: true },
  { to: `${ROTAS.minhaConta}/dados`, rotulo: 'Meus dados' },
  { to: `${ROTAS.minhaConta}/enderecos`, rotulo: 'Endereços' },
]

// "Minha conta": exige login; abas para compras, dados e endereços (item 6 · endereço salvo e histórico)
export default function ContaLayout() {
  const { usuario, sair } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()

  if (!usuario) return <Navigate to={`${ROTAS.entrar}?voltar=${encodeURIComponent(pathname)}`} replace />

  const ativa = (aba) => (aba.compras ? pathname === ROTAS.minhaConta || pathname.startsWith(`${ROTAS.minhaConta}/compras`) : pathname === aba.to)

  return (
    <>
      <PageHead titulo="Minha conta" descricao={`Olá, ${usuario.nome.split(' ')[0]}! Aqui ficam suas compras, dados e endereços.`} trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Minha conta' }]}>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Seções da conta">
            <ul className="flex flex-wrap gap-2">
              {ABAS.map((aba) => (
                <li key={aba.to}>
                  <NavLink
                    to={aba.to}
                    end
                    aria-current={ativa(aba) ? 'page' : undefined}
                    className={`inline-flex h-11 items-center rounded-full px-4 text-pequeno font-bold transition-colors ${ativa(aba) ? 'bg-primary text-primary-foreground' : 'border border-border-control hover:border-primary-text hover:text-primary-text'}`}
                  >
                    {aba.rotulo}
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

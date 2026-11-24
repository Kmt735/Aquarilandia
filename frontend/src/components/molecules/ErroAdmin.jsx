import { Link, useLocation } from 'react-router'
import ErroCompacto from './ErroCompacto'
import { ROTAS } from '../../utils/rotas'

export default function ErroAdmin({ erro, recarregar }) {
  const { pathname } = useLocation()
  return <div className="my-4">
    <ErroCompacto onTentar={recarregar}>{erro.message}</ErroCompacto>
    {[401, 403].includes(erro.status) && <Link className="alvo-toque mt-2 inline-flex items-center font-bold text-primary-text underline"
      to={`${ROTAS.entrar}?voltar=${encodeURIComponent(pathname)}`}>Entrar com outra conta</Link>}
  </div>
}

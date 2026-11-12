import { useCallback, useMemo, useState } from 'react'
import * as conta from '../services/conta'
import { AuthContext } from './contexts'

// Sessão do cliente. INTEGRAÇÃO: o backend usa cookie de sessão (`sid`); trocar sessaoAtual() por GET /api/auth/eu.
export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(conta.sessaoAtual)

  // Devolve o usuário para a tela de login decidir para onde ir (admin ou cliente)
  const entrar = useCallback(async (dados) => {
    const logado = await conta.entrar(dados)
    setUsuario(logado)
    return logado
  }, [])
  const cadastrar = useCallback(async (dados) => setUsuario(await conta.cadastrar(dados)), [])
  const sair = useCallback(async () => {
    await conta.sair()
    setUsuario(null)
  }, [])
  const atualizar = useCallback(async (dados) => setUsuario(await conta.atualizarDados(usuario, dados)), [usuario])

  const value = useMemo(
    () => ({ usuario, eAdmin: usuario?.papel === 'admin', entrar, cadastrar, sair, atualizar }),
    [usuario, entrar, cadastrar, sair, atualizar],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}
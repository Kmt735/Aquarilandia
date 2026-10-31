import { useCallback, useMemo, useState } from 'react'
import * as conta from '../services/conta'
import { AuthContext } from './contexts'

// Sessão do cliente. INTEGRAÇÃO: o backend usa cookie de sessão (`sid`); trocar sessaoAtual() por GET /api/auth/eu.
export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(conta.sessaoAtual)

  const entrar = useCallback(async (dados) => setUsuario(await conta.entrar(dados)), [])
  const cadastrar = useCallback(async (dados) => setUsuario(await conta.cadastrar(dados)), [])
  const sair = useCallback(async () => {
    await conta.sair()
    setUsuario(null)
  }, [])
  const atualizar = useCallback(async (dados) => setUsuario(await conta.atualizarDados(usuario, dados)), [usuario])

  const value = useMemo(() => ({ usuario, entrar, cadastrar, sair, atualizar }), [usuario, entrar, cadastrar, sair, atualizar])
  return <AuthContext value={value}>{children}</AuthContext>
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as conta from '../services/conta'
import { AuthContext } from './contexts'

// A sessão vem do cookie HttpOnly validado pelo servidor; dados de storage não autenticam ninguém.
export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroSessao, setErroSessao] = useState(null)
  const versao = useRef(0)
  const recarregarSessao = useCallback(() => {
    const consulta = ++versao.current
    return conta.sessaoAtual().then((atual) => {
      if (consulta === versao.current) { setUsuario(atual); setErroSessao(null) }
    }).catch((erro) => {
      if (consulta === versao.current) setErroSessao(erro.message)
    }).finally(() => {
      if (consulta === versao.current) setCarregando(false)
    })
  }, [])
  useEffect(() => {
    recarregarSessao()
    const expirar = () => { versao.current++; setUsuario(null); setErroSessao(null); setCarregando(false) }
    window.addEventListener('aquarilandia:sessao-expirada', expirar)
    return () => window.removeEventListener('aquarilandia:sessao-expirada', expirar)
  }, [recarregarSessao])

  // Devolve o usuário para a tela de login decidir para onde ir (admin ou cliente)
  const entrar = useCallback(async (dados) => {
    versao.current++
    try {
      const logado = await conta.entrar(dados)
      setUsuario(logado); setErroSessao(null)
      return logado
    } finally { setCarregando(false) }
  }, [])
  const cadastrar = useCallback((dados) => conta.cadastrar(dados), [])
  const sair = useCallback(async () => {
    await conta.sair()
    setUsuario(null)
  }, [])
  const atualizar = useCallback(async (dados) => setUsuario(await conta.atualizarDados(usuario, dados)), [usuario])

  const value = useMemo(
    () => ({ usuario, carregando, erroSessao, recarregarSessao, eAdmin: usuario?.papel === 'admin', entrar, cadastrar, sair, atualizar }),
    [usuario, carregando, erroSessao, recarregarSessao, entrar, cadastrar, sair, atualizar],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

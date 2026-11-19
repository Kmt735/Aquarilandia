import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as conta from '../services/conta'
import { AuthContext } from './contexts'

// A sessão vem do cookie HttpOnly validado pelo servidor; dados de storage não autenticam ninguém.
export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroSessao, setErroSessao] = useState(null)
  const [avisoSessao, setAvisoSessao] = useState(null)
  const versao = useRef(0)
  const invalidarConsultas = useCallback(() => { versao.current++ }, [])
  const recarregarSessao = useCallback(() => {
    const consulta = ++versao.current
    return conta.sessaoAtual().then((atual) => {
      if (consulta === versao.current) { setUsuario(atual); setErroSessao(null) }
    }).catch((erro) => {
      if (consulta === versao.current) { setUsuario(null); setErroSessao(erro.message) }
    }).finally(() => {
      if (consulta === versao.current) setCarregando(false)
    })
  }, [])
  useEffect(() => {
    recarregarSessao()
    const expirar = () => { versao.current++; setUsuario(null); setErroSessao(null); setCarregando(false); setAvisoSessao('Sua sessão expirou. Entre novamente para continuar.') }
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregarSessao() }
    window.addEventListener('aquarilandia:sessao-expirada', expirar)
    window.addEventListener('aquarilandia:revalidar-sessao', recarregarSessao)
    window.addEventListener('focus', recarregarSessao)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      invalidarConsultas()
      window.removeEventListener('aquarilandia:sessao-expirada', expirar)
      window.removeEventListener('aquarilandia:revalidar-sessao', recarregarSessao)
      window.removeEventListener('focus', recarregarSessao)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [recarregarSessao, invalidarConsultas])

  // Devolve o usuário para a tela de login decidir para onde ir (admin ou cliente)
  const entrar = useCallback(async (dados) => {
    const consulta = ++versao.current
    try {
      const logado = await conta.entrar(dados)
      if (consulta === versao.current) { setUsuario(logado); setErroSessao(null); setAvisoSessao(null) }
      return logado
    } finally { if (consulta === versao.current) setCarregando(false) }
  }, [])
  const cadastrar = useCallback((dados) => conta.cadastrar(dados), [])
  const sair = useCallback(async () => {
    versao.current++
    await conta.sair()
    versao.current++
    setUsuario(null)
  }, [])
  const atualizar = useCallback(async (dados) => setUsuario(await conta.atualizarDados(usuario, dados)), [usuario])

  const value = useMemo(
    () => ({ usuario, carregando, erroSessao, avisoSessao, recarregarSessao, eAdmin: usuario?.papel === 'admin', entrar, cadastrar, sair, atualizar }),
    [usuario, carregando, erroSessao, avisoSessao, recarregarSessao, entrar, cadastrar, sair, atualizar],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

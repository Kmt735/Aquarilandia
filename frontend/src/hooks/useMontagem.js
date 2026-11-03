import { useCallback, useEffect, useState } from 'react'
import { CHAVE_MONTAGEM, ETAPAS, LIMITE_QTD_MONTAGEM, lerMontagemSalva, montagemVazia } from '../lib/montagem'

function lerSalvo() {
  try { return lerMontagemSalva(localStorage.getItem(CHAVE_MONTAGEM)) } catch { return montagemVazia() }
}

// Estado do "Monte seu Aquário", salvo no navegador (chave versionada) para o cliente sair e voltar.
export default function useMontagem() {
  const [m, setM] = useState(lerSalvo)

  useEffect(() => {
    try { localStorage.setItem(CHAVE_MONTAGEM, JSON.stringify(m)) } catch {
      // Armazenamento bloqueado: a montagem vale só enquanto a página estiver aberta.
    }
  }, [m])

  const irPara = useCallback((indice) => setM((s) => ({ ...s, etapa: Math.max(0, Math.min(ETAPAS.length - 1, indice)) })), [])
  // Avançar (com ou sem escolha) marca a etapa atual como concluída
  const avancar = useCallback(() => setM((s) => ({
    ...s, etapa: Math.min(ETAPAS.length - 1, s.etapa + 1),
    concluidas: s.concluidas.includes(ETAPAS[s.etapa]) ? s.concluidas : [...s.concluidas, ETAPAS[s.etapa]],
  })), [])
  const concluirUltima = useCallback(() => setM((s) => ({ ...s, concluidas: [...new Set([...s.concluidas, ETAPAS[s.etapa]])] })), [])

  const mudarEtapa = (s, etapa, lista) => ({ ...s, escolhas: { ...s.escolhas, [etapa]: lista } })

  const escolherAquario = useCallback((id) => setM((s) => ({ ...mudarEtapa(s, 'aquario', [{ id, qtd: 1 }]), aquarioProprio: null })), [])
  const usarAquarioProprio = useCallback((dados) => setM((s) => ({ ...mudarEtapa(s, 'aquario', dados ? [] : s.escolhas.aquario), aquarioProprio: dados })), [])

  const alternar = useCallback((etapa, id, qtd = 1) => setM((s) => {
    const lista = s.escolhas[etapa]
    return mudarEtapa(s, etapa, lista.some((x) => x.id === id) ? lista.filter((x) => x.id !== id) : [...lista, { id, qtd: Math.min(qtd, LIMITE_QTD_MONTAGEM) }])
  }), [])
  const definirQtd = useCallback((etapa, id, qtd) => setM((s) => {
    if (etapa === 'aquario') return s
    const lista = s.escolhas[etapa]
    if (qtd < 1) return mudarEtapa(s, etapa, lista.filter((x) => x.id !== id))
    return mudarEtapa(s, etapa, lista.map((x) => (x.id === id ? { ...x, qtd: Math.min(qtd, LIMITE_QTD_MONTAGEM) } : x)))
  }), [])
  const remover = useCallback((etapa, id) => setM((s) => mudarEtapa(s, etapa, s.escolhas[etapa].filter((x) => x.id !== id))), [])
  const recomecar = useCallback(() => setM(montagemVazia()), [])

  return { montagem: m, irPara, avancar, concluirUltima, escolherAquario, usarAquarioProprio, alternar, definirQtd, remover, recomecar }
}

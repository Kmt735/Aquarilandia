import { useCallback, useEffect, useState } from 'react'
import { EVENTO_AVALIACOES_MODERADAS, resumoAvaliacoesAdmin } from '../services/admin-avaliacoes'

const INTERVALO_MS = 60000

// Quantas avaliações (produtos + site) esperam a loja conferir: o número no menu do painel.
// Confere ao abrir, a cada minuto, ao voltar para a aba e logo depois de cada moderação
export default function useAvaliacoesPendentes() {
  const [pendentes, setPendentes] = useState(0)

  const conferir = useCallback(() => resumoAvaliacoesAdmin()
    .then((r) => setPendentes(r?.pendentes ?? 0))
    .catch(() => { /* Tenta novamente na próxima conferência. */ }), [])

  useEffect(() => {
    conferir()
    const relogio = setInterval(conferir, INTERVALO_MS)
    const aoVoltar = () => document.visibilityState === 'visible' && conferir()
    window.addEventListener(EVENTO_AVALIACOES_MODERADAS, conferir)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(relogio)
      window.removeEventListener(EVENTO_AVALIACOES_MODERADAS, conferir)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [conferir])

  return pendentes
}

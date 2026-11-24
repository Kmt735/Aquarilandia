import { useCallback, useState } from 'react'
import useConsulta from './useConsulta'
import { chaveItem, enviarAvaliacaoProduto, jaAvaliou, listarAvaliacoesProduto, RESUMO_VAZIO, somarAoResumo } from '../services/avaliacoes-produto'

// Avaliações de um produto/peixe: a página chama uma vez e passa para o resumo (perto do título) e a seção.
// Recebe tipo + id da rota (já conhecidos antes do item carregar), então pode ficar antes dos "return" da página.
export default function useAvaliacoesProduto(tipo, id) {
  const item = { tipo, id }
  const chave = chaveItem(item)
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarAvaliacoesProduto(item), [chave])
  // Enviadas nesta visita (a chave evita vazar para outro item). Só as já aprovadas entram na lista e no resumo;
  // as pendentes esperam a loja conferir
  const [enviadas, setEnviadas] = useState({ chave, lista: [] })
  const desta = enviadas.chave === chave ? enviadas.lista : []
  const publicadas = desta.filter((a) => a.status === 'aprovada')

  const enviar = useCallback(async (campos) => {
    const avaliacao = await enviarAvaliacaoProduto({ tipo, id }, campos)
    const chaveEnvio = chaveItem({ tipo, id })
    setEnviadas((atual) => ({ chave: chaveEnvio, lista: [avaliacao, ...(atual.chave === chaveEnvio ? atual.lista : [])] }))
    return avaliacao
  }, [tipo, id])

  return {
    lista: [...publicadas, ...(dados?.itens ?? [])],
    resumo: somarAoResumo(dados?.resumo ?? RESUMO_VAZIO, publicadas),
    carregando,
    erro,
    recarregar,
    enviar,
    jaAvaliou: desta.length > 0 || jaAvaliou(item),
  }
}

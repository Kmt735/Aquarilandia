import { useCallback, useState } from 'react'
import useConsulta from './useConsulta'
import { chaveItem, enviarAvaliacaoProduto, jaAvaliou, listarAvaliacoesProduto, resumirNotas } from '../services/avaliacoes-produto'

// Avaliações de um produto/peixe: a página chama uma vez e passa para o resumo (perto do título) e a seção.
// Recebe tipo + id da rota (já conhecidos antes do item carregar), então pode ficar antes dos "return" da página.
export default function useAvaliacoesProduto(tipo, id) {
  const item = { tipo, id }
  const chave = chaveItem(item)
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarAvaliacoesProduto(item), [chave])
  // Avaliação recém-enviada aparece na hora, sem recarregar a lista (a chave evita vazar para outro item)
  const [novas, setNovas] = useState({ chave, lista: [] })
  const recentes = novas.chave === chave ? novas.lista : []
  const lista = [...recentes, ...(dados ?? [])]

  const enviar = useCallback(async (campos) => {
    const avaliacao = await enviarAvaliacaoProduto({ tipo, id }, campos)
    const chaveEnvio = chaveItem({ tipo, id })
    setNovas((atual) => ({ chave: chaveEnvio, lista: [avaliacao, ...(atual.chave === chaveEnvio ? atual.lista : [])] }))
    return avaliacao
  }, [tipo, id])

  return {
    lista,
    resumo: resumirNotas(lista),
    carregando,
    erro,
    recarregar,
    enviar,
    jaAvaliou: recentes.length > 0 || jaAvaliou(item),
  }
}

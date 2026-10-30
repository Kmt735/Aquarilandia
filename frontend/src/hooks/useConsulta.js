import { useCallback, useEffect, useState } from 'react'

// Carrega dados de um service: { dados, carregando, erro, recarregar } — base dos estados
// de carregamento (skeleton), erro (com "Tentar de novo") e vazio.
// "carregando" é derivado: a resposta guardada pertence a outra consulta (deps diferentes).
export default function useConsulta(carregar, deps = []) {
  const [versao, setVersao] = useState(0)
  const chave = JSON.stringify([...deps, versao])
  const [resposta, setResposta] = useState({ chave: null, dados: null, erro: null })

  useEffect(() => {
    let ativo = true
    carregar()
      .then((dados) => ativo && setResposta({ chave, dados, erro: null }))
      .catch((erro) => ativo && setResposta({ chave, dados: null, erro }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const carregando = resposta.chave !== chave
  return { dados: resposta.dados, erro: carregando ? null : resposta.erro, carregando, recarregar }
}

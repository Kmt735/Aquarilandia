import { useEffect } from 'react'

// Título da aba por página (item 24 · encontrável) e anúncio da troca de página para leitores de tela.
// `descricao` (opcional) vira a meta description enquanto a página estiver aberta.
export default function useTituloPagina(titulo, descricao) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Aquarilândia` : 'Aquarilândia · Peixes, plantas e projetos de aquários'
  }, [titulo])

  useEffect(() => {
    if (!descricao) return
    const meta = document.createElement('meta')
    meta.name = 'description'
    meta.content = descricao
    document.head.append(meta)
    return () => meta.remove()
  }, [descricao])
}

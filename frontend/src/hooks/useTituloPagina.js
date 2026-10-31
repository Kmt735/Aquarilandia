import { useEffect } from 'react'

// Título da aba por página (item 24 · encontrável) e anúncio da troca de página para leitores de tela
export default function useTituloPagina(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Aquarilândia` : 'Aquarilândia · Peixes, plantas e projetos de aquários'
  }, [titulo])
}

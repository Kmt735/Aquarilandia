import PageHead from '../molecules/PageHead'
import useTituloPagina from '../../hooks/useTituloPagina'

// Páginas internas: cabeçalho padrão (trilha + H1) + conteúdo
export default function PageTemplate({ eyebrow, titulo, descricao, trilha, cabecalhoExtra, children }) {
  useTituloPagina(titulo)
  return (
    <>
      <PageHead eyebrow={eyebrow} titulo={titulo} descricao={descricao} trilha={trilha}>
        {cabecalhoExtra}
      </PageHead>
      {children}
    </>
  )
}

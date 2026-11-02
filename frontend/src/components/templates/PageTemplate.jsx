import PageHead from '../molecules/PageHead'
import useTituloPagina from '../../hooks/useTituloPagina'

// Páginas internas: cabeçalho padrão (trilha + H1) + conteúdo
export default function PageTemplate({ eyebrow, titulo, descricao, metaDescricao, trilha, ilustracao, cabecalhoExtra, children }) {
  useTituloPagina(titulo, metaDescricao)
  return (
    <>
      <PageHead eyebrow={eyebrow} titulo={titulo} descricao={descricao} trilha={trilha} ilustracao={ilustracao}>
        {cabecalhoExtra}
      </PageHead>
      {children}
    </>
  )
}

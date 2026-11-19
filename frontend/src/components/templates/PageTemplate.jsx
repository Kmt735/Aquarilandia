import PageHead from '../molecules/PageHead'
import useTituloPagina from '../../hooks/useTituloPagina'

// Páginas internas: cabeçalho padrão (trilha + H1) + conteúdo
// `tituloDocumento` (opcional) troca só o título da aba do navegador, mantendo o H1 (ex.: abas de uma mesma página)
export default function PageTemplate({ eyebrow, titulo, tituloDocumento, descricao, metaDescricao, trilha, ilustracao, cabecalhoExtra, children }) {
  useTituloPagina(tituloDocumento ?? titulo, metaDescricao)
  return (
    <>
      <PageHead eyebrow={eyebrow} titulo={titulo} descricao={descricao} trilha={trilha} ilustracao={ilustracao}>
        {cabecalhoExtra}
      </PageHead>
      {children}
    </>
  )
}

import PageHead from '../molecules/PageHead'

<<<<<<< Updated upstream
// Páginas internas: cabeçalho padrão + conteúdo
export default function PageTemplate({ eyebrow, titulo, children }) {
  return (
    <>
      <PageHead eyebrow={eyebrow} titulo={titulo} />
=======
// Páginas internas: cabeçalho padrão (trilha + H1) + conteúdo
export default function PageTemplate({ eyebrow, titulo, descricao, metaDescricao, trilha, ilustracao, cabecalhoExtra, children }) {
  useTituloPagina(titulo, metaDescricao)
  return (
    <>
      <PageHead eyebrow={eyebrow} titulo={titulo} descricao={descricao} trilha={trilha} ilustracao={ilustracao}>
        {cabecalhoExtra}
      </PageHead>
>>>>>>> Stashed changes
      {children}
    </>
  )
}

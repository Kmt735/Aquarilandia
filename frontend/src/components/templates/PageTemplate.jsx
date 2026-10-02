import PageHead from '../molecules/PageHead'

// Páginas internas: cabeçalho padrão + conteúdo
export default function PageTemplate({ eyebrow, titulo, children }) {
  return (
    <>
      <PageHead eyebrow={eyebrow} titulo={titulo} />
      {children}
    </>
  )
}

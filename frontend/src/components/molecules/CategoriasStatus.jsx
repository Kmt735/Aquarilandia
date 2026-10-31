export default function CategoriasStatus({ carregando, erro, dados, recarregar }) {
  if (carregando) return <p role="status" className="p-3 text-pequeno text-text-muted">Carregando categorias…</p>
  if (erro) return <p role="alert" className="p-3 text-pequeno text-text-muted">Não conseguimos carregar as categorias. <button type="button" className="underline" onClick={recarregar}>Tentar de novo</button></p>
  if (!dados?.length) return <p role="status" className="p-3 text-pequeno text-text-muted">Nenhuma categoria disponível.</p>
  return null
}

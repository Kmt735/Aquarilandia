import PageTemplate from '../components/templates/PageTemplate'
import creditos from '../data/creditos-imagens.json'
import { ROTAS } from '../utils/rotas'

export default function CreditosImagensPage() {
  return (
    <PageTemplate titulo="Créditos das fotos" trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Créditos das fotos' }]}>
      <div className="mx-auto max-w-[900px] space-y-8 px-4 py-10 sm:px-6">
        <p className="text-corpo text-text-muted">
          Fotografias ilustrativas do catálogo de demonstração. Modelos, embalagens e capacidades podem variar.
          As fotos foram redimensionadas e convertidas para WebP, mantendo suas licenças de origem.
        </p>
        <ul className="space-y-6">
          {creditos.map((foto) => (
            <li key={foto.fonte} className="rounded-xl border border-border-strong p-5">
              <h2 className="text-h3">{foto.produtos.join(' · ')}</h2>
              <p className="mt-2 text-pequeno text-text-muted">Fotografia: {foto.titulo}</p>
              <p className="mt-2 text-pequeno text-text-muted">Autoria: {foto.autor}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-pequeno">
                <a href={foto.fonte} target="_blank" rel="noopener noreferrer" className="text-primary-text underline">Fotografia original (Wikimedia Commons)</a>
                <a href={foto.licencaUrl} target="_blank" rel="noopener noreferrer" className="text-primary-text underline">{foto.licenca}</a>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </PageTemplate>
  )
}

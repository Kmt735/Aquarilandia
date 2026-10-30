import { Navigate, useParams } from 'react-router'
import Aviso from '../components/molecules/Aviso'
import PageTemplate from '../components/templates/PageTemplate'
import { politicas } from '../data/loja'
import { ROTAS } from '../utils/rotas'

// Políticas do rodapé (item 26). Textos que faltam aparecem marcados "a definir com a loja".
export default function PoliticaPage() {
  const { tipo } = useParams()
  const politica = politicas[tipo]
  if (!politica) return <Navigate to={ROTAS.perguntas} replace />

  return (
    <PageTemplate titulo={politica.titulo} trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: politica.titulo }]}>
      <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 desk:py-14">
        <Aviso tipo="aviso" titulo="Texto provisório" className="mb-8">
          Esta página ainda está sendo escrita com a loja. Os trechos marcados “a definir com a loja” vão ser completados.
        </Aviso>
        {politica.secoes.map((s) => (
          <section key={s.titulo} className="mb-8">
            <h2 className="mb-2 text-h3">{s.titulo}</h2>
            <p className="text-corpo text-text-muted">{s.texto}</p>
          </section>
        ))}
      </div>
    </PageTemplate>
  )
}

import { Navigate, useParams } from 'react-router'
import Aviso from '../components/molecules/Aviso'
import PageTemplate from '../components/templates/PageTemplate'
import { politicas } from '../data/loja'
import { ROTAS } from '../utils/rotas'

// Políticas comerciais fornecidas pela loja; somente documentos ainda pendentes exibem o aviso provisório.
export default function PoliticaPage() {
  const { tipo } = useParams()
  const politica = politicas[tipo]
  if (!politica) return <Navigate to={ROTAS.perguntas} replace />

  return (
    <PageTemplate titulo={politica.titulo} trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: politica.titulo }]}>
      <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 desk:py-14">
        {politica.provisoria && <Aviso tipo="aviso" titulo="Texto provisório" className="mb-8">
          Esta página ainda está sendo escrita com a loja. Os trechos marcados “a definir com a loja” vão ser completados.
        </Aviso>}
        {politica.introducao && <p className="mb-8 text-corpo text-text-muted">{politica.introducao}</p>}
        {politica.secoes.map((s) => (
          <section key={s.titulo} className="mb-8">
            <h2 className="mb-2 text-h3">{s.titulo}</h2>
            <div className="space-y-3 text-corpo text-text-muted">
              {(s.blocos ?? [s.texto]).map((bloco, indice) => typeof bloco === 'string' ? <p key={indice}>{bloco}</p>
                : bloco.lista ? <ul key={indice} className="list-disc space-y-1 pl-6">{bloco.lista.map((item) => <li key={item}>{item}</li>)}</ul>
                  : <div key={indice}><h3 className="font-semibold text-foreground">{bloco.subtitulo}</h3><p>{bloco.texto}</p></div>)}
            </div>
          </section>
        ))}
        {politica.conclusao && <p className="text-corpo text-text-muted">{politica.conclusao}</p>}
      </div>
    </PageTemplate>
  )
}

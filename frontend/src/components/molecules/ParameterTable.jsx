import Termo from '../atoms/Termo'
import { termos } from '../../data/glossario'

// Tabela de parâmetros da água. O termo abre a explicação na própria linha.
export default function ParameterTable({ parametros, legenda }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border-strong bg-surface">
      <table className="w-full border-collapse text-left text-pequeno">
        <caption className="sr-only">{legenda}</caption>
        <thead className="bg-surface-tint">
          <tr>
            <th scope="col" className="px-3 py-3 font-bold sm:px-4">Parâmetro</th>
            <th scope="col" className="px-3 py-3 font-bold sm:px-4">Faixa ideal</th>
            <th scope="col" className="px-3 py-3 font-bold sm:px-4">O que significa</th>
          </tr>
        </thead>
        <tbody>
          {parametros.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <th scope="row" className="px-3 py-3 align-top font-bold sm:px-4">
                {termos[p.id] ? <Termo id={p.id}>{p.nome}</Termo> : p.nome}
              </th>
              <td className="px-3 py-3 align-top font-semibold text-primary-text tabular-nums sm:px-4">{p.ideal}</td>
              <td className="px-3 py-3 align-top text-text-muted sm:px-4">{p.significado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

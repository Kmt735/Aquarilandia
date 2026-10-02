import { classeCampo } from './campo'

export default function Select({ estado, opcoes, placeholder = 'Selecione…', ...props }) {
  return (
    <select className={classeCampo(estado)} {...props}>
      <option value="">{placeholder}</option>
      {opcoes.map((opcao) => (
        <option key={opcao}>{opcao}</option>
      ))}
    </select>
  )
}

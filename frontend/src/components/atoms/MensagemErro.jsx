import { dividirMensagem } from '../../utils/validacao'

// Mensagem de erro no padrão do item 9: o erro curto em destaque e, na linha de baixo, como corrigir.
// "CEP inválido. Digite os 8 números, como 36300-000." → **CEP inválido** / Digite os 8 números…
// Texto sem segunda frase (ex.: mensagem vinda da API) aparece inteiro, em destaque.
export default function MensagemErro({ children }) {
  const { erro, ajuda } = dividirMensagem(children)
  return (
    <span className="flex flex-col">
      <span className="font-bold">{erro}</span>
      {ajuda && <span className="font-normal">{ajuda}</span>}
    </span>
  )
}

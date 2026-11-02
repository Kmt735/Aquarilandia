import Termo from './Termo'

// Texto dos dados com termos do glossário: [[id]] ou [[id|texto mostrado]]
export default function TextoComTermos({ children }) {
  return children.split(/(\[\[[^\]]+\]\])/).map((parte, i) => {
    const marca = parte.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/)
    if (!marca) return parte
    return (
      <Termo key={i} id={marca[1]}>
        {marca[2]}
      </Termo>
    )
  })
}

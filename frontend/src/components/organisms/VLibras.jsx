import { useEffect } from 'react'

const URL_RAIZ = 'https://vlibras.gov.br/app'

// O widget só pode ser criado uma vez por página (vale também para o StrictMode do React em desenvolvimento)
let iniciado = false

// VLibras: tradutor oficial do governo federal, de português para Libras (avatar 3D).
// O script e os arquivos do avatar vêm de vlibras.gov.br. Se um dia o site ganhar uma política de
// segurança de conteúdo (CSP), será preciso liberar esse endereço.
export default function VLibras() {
  useEffect(() => {
    if (iniciado) return
    iniciado = true
    const script = document.createElement('script')
    script.src = `${URL_RAIZ}/vlibras-plugin.js`
    script.async = true
    script.onload = () => new window.VLibras.Widget(URL_RAIZ)
    script.onerror = () => {
      iniciado = false // fora do ar ou bloqueado: o site segue normal e tenta de novo na próxima visita
    }
    document.body.appendChild(script)
  }, [])

  return (
    <div vw="" className="enabled">
      <div vw-access-button="" className="active" />
      <div vw-plugin-wrapper="">
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  )
}
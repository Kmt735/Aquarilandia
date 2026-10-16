import logoClaro from '../../assets/logo-claro.png'
import logoEscuro from '../../assets/logo-escuro.png'

// Logo completo: letreiro azul no tema claro, letreiro branco com contorno no escuro
export default function LogoCompleto({ className = 'h-24 w-auto' }) {
  return (
    <>
      <img src={logoClaro} alt="Aquarilândia" className={`${className} dark:hidden`} />
      <img src={logoEscuro} alt="Aquarilândia" className={`${className} hidden dark:block`} />
    </>
  )
}

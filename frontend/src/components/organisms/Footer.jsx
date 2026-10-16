import LogoCompleto from '../atoms/LogoCompleto'

const titulo = 'mb-3 font-sans text-[12px] font-semibold tracking-[.14em] text-foreground uppercase'
const texto = 'block text-[14px] leading-[1.9] text-text-muted'
const link = `${texto} transition-colors hover:text-primary-text`

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <span aria-hidden="true" className="neon-line mx-auto block h-px max-w-[1200px] opacity-60" />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-14 pb-12 sm:grid-cols-2 sm:px-6 desk:grid-cols-[1.4fr_1fr_1fr_1fr] desk:px-10">
        <div>
          <LogoCompleto className="mb-4 h-20 w-auto" />
          <h5 className="sr-only">Aquarilândia</h5>
          <p className={texto}>Peixes, plantas e projetos de aquários.</p>
        </div>
        <div>
          <h5 className={titulo}>Contato</h5>
          <a href="#" className={link}>wa.link/aquarilandia</a>
          <a href="#" className={link}>WhatsApp</a>
        </div>
        <div>
          <h5 className={titulo}>Endereço</h5>
          <p className={texto}>
            Avenida Josué de Queiroz, 115
            <br />
            São João del Rei
          </p>
        </div>
        <div>
          <h5 className={titulo}>Redes sociais</h5>
          <a href="#" className={link}>Instagram</a>
          <a href="#" className={link}>Threads</a>
        </div>
      </div>
    </footer>
  )
}

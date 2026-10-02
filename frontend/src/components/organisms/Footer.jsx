const titulo = 'mb-2.5 font-display text-[15px] font-bold text-white'
const texto = 'block text-[13px] leading-[1.8] text-ink-soft'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-night px-4 pt-12 pb-8 text-ink-soft desk:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-6">
        <div>
          <h5 className={titulo}>Aquarilândia</h5>
          <p className={texto}>Peixes, plantas e projetos de aquários.</p>
        </div>
        <div>
          <h5 className={titulo}>Contato</h5>
          <a href="#" className={texto}>wa.link/aquarilandia</a>
          <a href="#" className={texto}>WhatsApp</a>
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
          <a href="#" className={texto}>Instagram</a>
          <a href="#" className={texto}>Threads</a>
        </div>
      </div>
    </footer>
  )
}

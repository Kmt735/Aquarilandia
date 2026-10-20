import LogoCompleto from '../atoms/LogoCompleto'
import WaterWave from '../atoms/WaterWave'
import useWhatsApp from '../../hooks/useWhatsApp'


const contato = {
  enderecos: [
    {
      unidade: 'Centro',
      linhas: ['Rua Antônio Rocha, 27', 'Centro'],
      mapaUrl:
        'https://www.google.com/maps/place/Aquaril%C3%A2ndia/@-21.1324225,-44.2587924,17z/data=!3m1!4b1!4m6!3m5!1s0xa1c88596df8fb1:0xe9529c471598d2b3!8m2!3d-21.1324225!4d-44.2562175!16s%2Fg%2F1th600p_?entry=ttu&g_ep=EgoyMDI2MTAxMy4wIKXMDSoASAFQAw%3D%3D',
    },
    {
      unidade: 'Matosinhos',
      linhas: ['Avenida Josué de Queiroz, 115', 'São João del Rei'],
      mapaUrl:
        'https://www.google.com/maps/place/Aquaril%C3%A2ndia+Matosinhos+Aquarismo/@-21.1279278,-44.2426833,17z/data=!3m1!4b1!4m6!3m5!1s0xa1c7758e94b9b9:0x33cd0a02d79b42e!8m2!3d-21.1279278!4d-44.2401084!16s%2Fg%2F11vc2rs2x9?entry=ttu&g_ep=EgoyMDI2MTAxMy4wIKXMDSoASAFQAw%3D%3D',
    },
  ],
  redes: [
    { nome: 'Instagram', url: 'https://www.instagram.com/aquarilandia/' },   
    { nome: 'Facebook', url: 'https://www.facebook.com/aquarilandiasjdr/?locale=pt_BR' }, 
  ],
}
const titulo = 'mb-3 font-sans text-[12px] font-bold tracking-[.12em] text-primary-dark uppercase dark:text-foreground'
const texto = 'block text-[14px] leading-[1.9] text-text-muted'
const link = `${texto} transition-colors hover:text-primary-text`

export default function Footer() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <footer>
      <WaterWave variante="rodape" />
      <div className="bg-surface-tint">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-14 pb-12 sm:grid-cols-2 sm:px-6 desk:grid-cols-[1.4fr_1fr_1fr_1fr] desk:px-10">
          <div>
            <LogoCompleto className="mb-4 h-20 w-auto" />
            <h5 className="sr-only">Aquarilândia</h5>
            <p className={texto}>Peixes, plantas e projetos de aquários.</p>
          </div>

          <div>
            <h5 className={titulo}>Contato</h5>
            <button type="button" onClick={() => abrirWhatsApp('Vim pelo site da Aquarilândia')} className={`${link} text-left`}>
              Falar no WhatsApp
            </button>
          </div>

          <div>
            <h5 className={titulo}>Endereços</h5>
            {contato.enderecos.map((endereco) => (
              <div key={endereco.unidade} className="mb-4 last:mb-0">
                <p className={`${texto} font-medium text-foreground`}>{endereco.unidade}</p>
                <address className={`${texto} not-italic`}>
                  {endereco.linhas.map((linha, indice) => (
                    <span key={`${indice}-${linha}`} className="block">
                      {linha}
                    </span>
                  ))}
                </address>
                <a href={endereco.mapaUrl} target="_blank" rel="noopener noreferrer" className={`${link} text-primary-text`}>
                  Ver no mapa
                </a>
              </div>
            ))}
          </div>

          <div>
            <h5 className={titulo}>Redes sociais</h5>
            {contato.redes.map((rede) => (
              <a
                key={rede.nome}
                href={rede.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Aquarilândia no ${rede.nome} (abre em nova aba)`}
                className={link}
              >
                {rede.nome}
              </a>
            ))}
          </div>
        </div>

        <p className="mx-auto max-w-[1200px] border-t border-border-strong/60 px-4 py-5 text-[13px] text-text-muted sm:px-6 desk:px-10">
          © {new Date().getFullYear()} Aquarilândia. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
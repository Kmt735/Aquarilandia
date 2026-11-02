import LogoCompleto from '../atoms/LogoCompleto'
import WaterWave from '../atoms/WaterWave'
<<<<<<< Updated upstream
=======
import AquariumBackground from '../molecules/AquariumBackground'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import { A_DEFINIR, AVISO_PAGAMENTO, formasPagamento, politicas, redes, unidades } from '../../data/loja'
import useMediaQuery from '../../hooks/useMediaQuery'
>>>>>>> Stashed changes
import useWhatsApp from '../../hooks/useWhatsApp'


<<<<<<< Updated upstream
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
=======
// Só as faixas vazias: o respiro acima das colunas e o lado direito da linha do copyright
const RAIAS_PEIXES = [
  { top: 6, de: 0, ate: 100, celular: true },
  { bottom: 22, de: 56, ate: 98 },
  { top: 24, de: 0, ate: 100, celular: true },
  { bottom: 8, de: 56, ate: 98 },
]

// Rodapé completo (item 26 · crível): endereços, horário, Instagram, WhatsApp, pagamento e políticas.
// No celular, cada grupo recolhe (<details>) para encurtar a página (item 19).
function Grupo({ titulo, children }) {
  const largo = useMediaQuery('(min-width: 640px)')
  return (
    <details key={String(largo)} open={largo} className="group border-b border-border-strong py-2 sm:border-0 sm:py-0 [&[open]>summary_svg]:rotate-180">
      <summary
        onClick={(e) => largo && e.preventDefault()}
        className="flex min-h-11 cursor-pointer list-none items-center justify-between sm:min-h-0 sm:cursor-default [&::-webkit-details-marker]:hidden"
      >
        <h2 className="text-legenda font-bold tracking-[.1em] text-foreground uppercase">{titulo}</h2>
        <ChevronDown aria-hidden="true" className="size-4 transition-transform sm:hidden" />
      </summary>
      <div className="pt-2 pb-2 sm:pt-3">{children}</div>
    </details>
  )
>>>>>>> Stashed changes
}
const titulo = 'mb-3 font-sans text-[12px] font-bold tracking-[.12em] text-primary-dark uppercase dark:text-foreground'
const texto = 'block text-[14px] leading-[1.9] text-text-muted'
const link = `${texto} transition-colors hover:text-primary-text`

export default function Footer() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <footer>
      <WaterWave variante="rodape" />
<<<<<<< Updated upstream
      <div className="bg-surface-tint">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-14 pb-12 sm:grid-cols-2 sm:px-6 desk:grid-cols-[1.4fr_1fr_1fr_1fr] desk:px-10">
          <div>
            <LogoCompleto className="mb-4 h-20 w-auto" />
            <h5 className="sr-only">Aquarilândia</h5>
            <p className={texto}>Peixes, plantas e projetos de aquários.</p>
=======
      <div className="agua-funda relative overflow-hidden bg-surface-tint">
        <AquariumBackground raias={RAIAS_PEIXES} />
        <div className="relative mx-auto grid max-w-[1200px] gap-x-10 gap-y-2 px-4 pt-10 pb-8 sm:grid-cols-2 sm:gap-y-8 sm:px-6 desk:grid-cols-[1.3fr_1.2fr_1fr_1fr] desk:px-10">
          <div className="pb-4 sm:pb-0">
            <LogoCompleto className="mb-3 h-16 w-auto" />
            <p className="max-w-[280px] text-pequeno text-text-muted">Peixes, plantas e projetos de aquários em São João del Rei/MG.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => abrirWhatsApp()}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border-control px-4 text-pequeno font-bold hover:border-primary-text hover:text-primary-text"
              >
                <WhatsAppIcon className="size-[18px]" />
                WhatsApp
              </button>
              {redes.map((r) => (
                <a
                  key={r.nome}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center rounded-full border border-border-control px-4 text-pequeno font-bold hover:border-primary-text hover:text-primary-text"
                >
                  {r.nome}
                  <span className="sr-only"> da Aquarilândia (abre em nova aba)</span>
                </a>
              ))}
            </div>
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
        <p className="mx-auto max-w-[1200px] border-t border-border-strong/60 px-4 py-5 text-[13px] text-text-muted sm:px-6 desk:px-10">
=======
        <p className="relative mx-auto max-w-[1200px] border-t border-border-strong px-4 py-5 text-legenda text-text-muted sm:px-6 desk:px-10">
>>>>>>> Stashed changes
          © {new Date().getFullYear()} Aquarilândia. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
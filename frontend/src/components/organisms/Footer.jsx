import { ChevronDown, Clock, CreditCard, MapPin, QrCode } from 'lucide-react'
import { Link } from 'react-router'
import LogoCompleto from '../atoms/LogoCompleto'
import WaterWave from '../atoms/WaterWave'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import { A_DEFINIR, AVISO_PAGAMENTO, formasPagamento, politicas, redes, unidades } from '../../data/loja'
import useMediaQuery from '../../hooks/useMediaQuery'
import useWhatsApp from '../../hooks/useWhatsApp'
import { ROTAS, urlPolitica } from '../../utils/rotas'

const link = 'alvo-toque inline-block py-1 text-pequeno text-text-muted underline-offset-4 transition-colors hover:text-primary-text hover:underline'
const ICONE_PAGAMENTO = { Cartão: CreditCard, PIX: QrCode }

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
}

export default function Footer() {
  const abrirWhatsApp = useWhatsApp()

  return (
    <footer>
      <WaterWave variante="rodape" />
      <div className="bg-surface-tint">
        <div className="mx-auto grid max-w-[1200px] gap-x-10 gap-y-2 px-4 pt-10 pb-8 sm:grid-cols-2 sm:gap-y-8 sm:px-6 desk:grid-cols-[1.3fr_1.2fr_1fr_1fr] desk:px-10">
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
          </div>

          <Grupo titulo="Lojas físicas">
            <ul className="flex flex-col gap-4">
              {unidades.map((u) => (
                <li key={u.unidade}>
                  <p className="text-pequeno font-bold">{u.unidade}</p>
                  <address className="text-pequeno text-text-muted not-italic">
                    {u.linhas.map((l) => (
                      <span key={l} className="flex items-start gap-1.5">
                        {l === u.linhas[0] && <MapPin aria-hidden="true" className="mt-1 size-3.5 shrink-0" />}
                        <span className={l === u.linhas[0] ? '' : 'pl-5'}>{l}</span>
                      </span>
                    ))}
                  </address>
                  <p className="flex items-center gap-1.5 text-pequeno text-text-muted">
                    <Clock aria-hidden="true" className="size-3.5" />
                    Horário: {u.horario ?? A_DEFINIR}
                  </p>
                  <a href={u.mapaUrl} target="_blank" rel="noopener noreferrer" className={`${link} font-semibold text-primary-text!`}>
                    Ver no mapa<span className="sr-only"> a unidade {u.unidade} (abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
          </Grupo>

          <Grupo titulo="Ajuda">
            <ul>
              <li><Link to={ROTAS.perguntas} className={link}>Perguntas frequentes</Link></li>
              <li><Link to={ROTAS.primeiroAquario} className={link}>Meu Primeiro Aquário</Link></li>
              <li><Link to={ROTAS.servicos} className={link}>Serviços e orçamento</Link></li>
              <li><Link to={ROTAS.minhaConta} className={link}>Minhas compras</Link></li>
            </ul>
            <h2 className="mt-5 mb-1 text-legenda font-bold tracking-[.1em] text-foreground uppercase">Políticas</h2>
            <ul>
              {Object.entries(politicas).map(([tipo, p]) => (
                <li key={tipo}>
                  <Link to={urlPolitica(tipo)} className={link}>
                    {p.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </Grupo>

          <Grupo titulo="Pagamento">
            <ul className="flex flex-wrap gap-2">
              {formasPagamento.map((f) => {
                const Icone = ICONE_PAGAMENTO[f] ?? CreditCard
                return (
                  <li key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-pequeno font-semibold">
                    <Icone aria-hidden="true" className="size-4 text-primary-text" />
                    {f}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-legenda text-text-muted">{AVISO_PAGAMENTO}</p>
          </Grupo>
        </div>

        <p className="mx-auto max-w-[1200px] border-t border-border-strong px-4 py-5 text-legenda text-text-muted sm:px-6 desk:px-10">
          © {new Date().getFullYear()} Aquarilândia. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

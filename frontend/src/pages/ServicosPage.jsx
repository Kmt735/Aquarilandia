import FutureBanner from '../components/organisms/FutureBanner'
import ServiceGrid from '../components/organisms/ServiceGrid'
import PageTemplate from '../components/templates/PageTemplate'
import { ROTAS } from '../utils/rotas'

export default function ServicosPage() {
  return (
    <PageTemplate
      eyebrow="Projetos de aquários"
      titulo="Serviços"
      descricao="Da montagem à manutenção. Todos os serviços são sob orçamento: conte o que precisa e a loja responde pelo WhatsApp."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Serviços' }]}
    >
      <ServiceGrid />
      <FutureBanner />
    </PageTemplate>
  )
}

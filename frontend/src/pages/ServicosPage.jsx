import FutureBanner from '../components/organisms/FutureBanner'
import ServiceGrid from '../components/organisms/ServiceGrid'
import PageTemplate from '../components/templates/PageTemplate'

export default function ServicosPage() {
  return (
    <PageTemplate eyebrow="Projetos de aquários" titulo="Serviços">
      <ServiceGrid />
      <FutureBanner />
    </PageTemplate>
  )
}

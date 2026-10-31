import { Bug, CloudFog, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Button from '../atoms/Button'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import SectionHead from '../molecules/SectionHead'
import useWhatsApp from '../../hooks/useWhatsApp'

// Item 35 · solução de problemas. Os textos serão escritos pelo grupo com a loja:
// aqui fica só a estrutura (nada de orientação de saúde animal inventada).
const PROBLEMAS = [
  { id: 'agua-turva', titulo: 'Água turva', Icone: CloudFog },
  { id: 'algas', titulo: 'Algas', Icone: Sprout },
  { id: 'peixe-doente', titulo: 'Peixe doente', Icone: Bug },
]

export default function ProblemasComuns() {
  const abrirWhatsApp = useWhatsApp()
  return (
    <section aria-labelledby="titulo-problemas" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 desk:px-10">
      <SectionHead id="titulo-problemas" eyebrow="Problemas comuns" titulo="Algo deu errado no aquário?" descricao="Guias curtos para os problemas mais comuns do dia a dia." />
      <ul className="grid gap-4 sm:grid-cols-3">
        {PROBLEMAS.map(({ id, titulo, Icone }) => (
          <li key={id} className="flex flex-col rounded-card border border-dashed border-border-control bg-surface p-5">
            <Icone aria-hidden="true" className="mb-3 size-6 text-primary-text" />
            <h3 className="text-h4">{titulo}</h3>
            <Badge variant="aviso" className="mt-2">
              Conteúdo em produção
            </Badge>
            <p className="mt-3 flex-1 text-pequeno text-text-muted">Enquanto o guia não fica pronto, a equipe da loja ajuda pelo WhatsApp.</p>
            <Button variant="secundario" tamanho="sm" className="mt-4 self-start" onClick={() => abrirWhatsApp(titulo.toLowerCase())}>
              <WhatsAppIcon className="size-4" />
              Perguntar à loja
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

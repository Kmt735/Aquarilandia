import {
  BookOpen,
  Building2,
  Castle,
  Droplets,
  Fish,
  FlaskConical,
  Folder,
  Hammer,
  LeafyGreen,
  Lightbulb,
  MessageCircle,
  Mountain,
  Package,
  PencilRuler,
  Shell,
  Sprout,
  ThermometerSun,
  Waves,
  Wheat,
  Wrench,
} from 'lucide-react'
import AquarioIcon from '@/components/icons/AquarioIcon'

// Ícones da interface (Lucide) no lugar dos emojis guardados nos dados — os dados não mudam.
export const iconeCategoria = {
  Aquários: AquarioIcon,
  Filtros: Droplets,
  Bombas: Waves,
  Iluminação: Lightbulb,
  Termostatos: ThermometerSun,
  Rações: Wheat,
  Condicionadores: FlaskConical,
  Substratos: Mountain,
  Plantas: LeafyGreen,
  Decorações: Castle,
  Acessórios: Shell,
}

export const iconeServico = {
  montagem: Hammer,
  plantados: Sprout,
  personalizados: PencilRuler,
  manutencao: Wrench,
  consultoria: MessageCircle,
  empresas: Building2,
}

export const iconeBusca = { Produto: Package, Peixe: Fish, Categoria: Folder, Página: BookOpen }

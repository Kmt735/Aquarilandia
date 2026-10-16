import {
  BookOpen,
  Box,
  Building2,
  Castle,
  Droplets,
  Fish,
  FlaskConical,
  Folder,
  Hammer,
  Leaf,
  Lightbulb,
  MessageCircle,
  Mountain,
  Package,
  PencilRuler,
  Sprout,
  Thermometer,
  Waves,
  Wheat,
  Wrench,
} from 'lucide-react'

// Ícones da interface (Lucide) no lugar dos emojis guardados nos dados — os dados não mudam.
export const iconeCategoria = {
  Aquários: Box,
  Filtros: Droplets,
  Bombas: Waves,
  Iluminação: Lightbulb,
  Termostatos: Thermometer,
  Rações: Wheat,
  Condicionadores: FlaskConical,
  Substratos: Mountain,
  Plantas: Leaf,
  Decorações: Castle,
  Acessórios: Wrench,
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

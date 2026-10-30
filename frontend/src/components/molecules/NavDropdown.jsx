import { ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router'
import SublinhadoNav from '../atoms/SublinhadoNav'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { iconeCategoria } from '@/lib/icones'
import { categorias } from '../../data/categorias'
import { descricaoCategoria } from '../../data/glossario'
import { urlLoja } from '../../utils/rotas'

// Submenu "Loja" com TODAS as categorias e a linha que explica cada uma
export default function NavDropdown({ ativo }) {
  const navigate = useNavigate()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={`group/link relative flex min-h-11 items-center gap-1 text-pequeno font-bold transition-colors outline-none hover:text-primary-text data-[state=open]:text-primary-text ${ativo ? 'text-primary-text' : 'text-foreground'}`}
      >
        Loja
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-data-[state=open]/link:rotate-180" />
        <SublinhadoNav ativo={ativo} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" sideOffset={14} className="grid w-[560px] grid-cols-2 gap-0.5 rounded-card border-border-strong p-2 shadow-pop">
        {categorias.map((c) => {
          const Icone = iconeCategoria[c.nome]
          return (
            <DropdownMenuItem
              key={c.nome}
              onSelect={() => navigate(urlLoja({ categoria: c.nome }))}
              className="items-start gap-2.5 rounded-xl px-2.5 py-2 text-foreground focus:bg-surface-tint focus:text-primary-text"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                <Icone aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-pequeno font-bold">{c.nome}</span>
                <span className="block text-legenda text-text-muted">{descricaoCategoria[c.nome]}</span>
              </span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator className="col-span-full" />
        <DropdownMenuItem
          onSelect={() => navigate(urlLoja({}))}
          className="col-span-full min-h-11 justify-center rounded-xl text-pequeno font-bold text-primary-text focus:bg-surface-tint focus:text-primary-text"
        >
          Ver loja completa →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
import { urlLoja } from '../../utils/rotas'

// H7 · Atalho para as categorias da loja
export default function NavDropdown({ ativo }) {
  const navigate = useNavigate()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={`group/link relative flex items-center gap-1 py-2 text-[15px] font-bold transition-colors outline-none hover:text-primary-text data-[state=open]:text-primary-text ${ativo ? 'text-primary-text' : 'text-foreground'}`}
      >
        Loja
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-data-[state=open]/link:rotate-180" />
        <SublinhadoNav ativo={ativo} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" sideOffset={14} className="grid w-[380px] grid-cols-2 gap-0.5 rounded-card border-border p-2 shadow-pop">
        {categorias.map((c) => {
          const Icone = iconeCategoria[c.nome]
          return (
            <DropdownMenuItem
              key={c.nome}
              onSelect={() => navigate(urlLoja({ categoria: c.nome }))}
              className="gap-2.5 rounded-xl px-2.5 py-2 text-[14px] font-semibold text-foreground focus:text-primary-text"
            >
              {Icone && (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-tint text-primary-text">
                  <Icone aria-hidden="true" className="size-4" />
                </span>
              )}
              {c.nome}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator className="col-span-full" />
        <DropdownMenuItem
          onSelect={() => navigate(urlLoja({}))}
          className="col-span-full justify-center rounded-xl py-2 text-[14px] font-bold text-primary-text focus:text-primary-text"
        >
          Ver loja completa →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

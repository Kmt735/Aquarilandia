// Linha neon fina sob o link do menu: aparece no hover/foco (grupo `link`) e fica fixa no item ativo
export default function SublinhadoNeon({ ativo }) {
  return (
    <span
      aria-hidden="true"
      className={`neon-line absolute inset-x-0 -bottom-0.5 h-px origin-left transition-transform duration-200 ${
        ativo ? 'scale-x-100' : 'scale-x-0 group-hover/link:scale-x-100 group-focus-visible/link:scale-x-100 group-data-[state=open]/link:scale-x-100'
      }`}
    />
  )
}

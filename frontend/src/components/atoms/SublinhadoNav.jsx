// Traço azul arredondado sob o link do menu: aparece no hover/foco (grupo `link`) e fica fixo no item ativo
export default function SublinhadoNav({ ativo }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-x-0 bottom-2 h-0.5 origin-left rounded-full bg-primary-text transition-transform duration-200 ${
        ativo ? 'scale-x-100' : 'scale-x-0 group-hover/link:scale-x-100 group-focus-visible/link:scale-x-100 group-data-[state=open]/link:scale-x-100'
      }`}
    />
  )
}

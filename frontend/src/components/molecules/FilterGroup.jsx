// Grupo de filtros de escolha única: rádio nativo (teclado e leitor de tela de graça), com cara de lista
export default function FilterGroup({ titulo, nome, itens, ativo, onSelecionar, descricoes }) {
  return (
    <fieldset className="mb-6 last:mb-0">
      <legend className="mb-2 text-legenda font-bold tracking-[.08em] text-text-muted uppercase">{titulo}</legend>
      <ul className="flex flex-col gap-0.5">
        {itens.map((item) => {
          const selecionado = (ativo ?? '') === item.valor
          const id = `${nome}-${item.valor || 'todos'}`
          return (
            <li key={item.valor}>
              <input
                type="radio"
                id={id}
                name={nome}
                value={item.valor}
                checked={selecionado}
                onChange={() => onSelecionar(item.valor)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-xl px-3 py-1.5 text-pequeno transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-text ${
                  selecionado ? 'bg-primary-soft font-bold text-primary-text' : 'text-foreground hover:bg-surface-tint hover:text-primary-text'
                }`}
              >
                {item.rotulo}
                {descricoes?.[item.valor] && <span className="text-legenda font-normal text-text-muted">{descricoes[item.valor]}</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

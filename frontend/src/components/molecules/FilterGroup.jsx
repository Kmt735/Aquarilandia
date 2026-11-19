import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

// Grupo de filtros de escolha única: rádio nativo (teclado e leitor de tela de graça).
// - variante "lista": uma opção por linha; "pilulas": opções curtas lado a lado (ex.: tipo de água)
// - `limite`: mostra só as primeiras opções e um botão "Mostrar todas" (evita a parede de controles)
// - `legendaOculta`: quando o título já aparece no cabeçalho da seção (acordeão), a legenda fica só para leitor de tela
// Os ids vêm do useId: a mesma lista aparece na lateral e na gaveta do celular sem repetir id.
export default function FilterGroup({ titulo, nome, itens, ativo, onSelecionar, descricoes, variante = 'lista', limite, legendaOculta = false }) {
  const base = useId()
  const [todas, setTodas] = useState(false)
  const indiceAtivo = itens.findIndex((i) => i.valor === (ativo ?? ''))
  const cortar = limite && itens.length > limite + 1 && !todas && indiceAtivo < limite
  const visiveis = cortar ? itens.slice(0, limite) : itens
  const pilulas = variante === 'pilulas'

  return (
    <fieldset className="mb-6 last:mb-0">
      <legend className={legendaOculta ? 'sr-only' : 'mb-2 text-legenda font-bold tracking-[.08em] text-text-muted uppercase'}>{titulo}</legend>
      <ul className={pilulas ? 'flex flex-wrap gap-2' : 'flex flex-col gap-0.5'}>
        {visiveis.map((item) => {
          const selecionado = (ativo ?? '') === item.valor
          const id = `${base}-${item.valor || 'todos'}`
          return (
            <li key={item.valor}>
              <input
                type="radio"
                id={id}
                name={`${nome}-${base}`}
                value={item.valor}
                checked={selecionado}
                onChange={() => onSelecionar(item.valor)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={
                  pilulas
                    ? `flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-pequeno whitespace-nowrap transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-text ${
                        selecionado ? 'border-primary-text bg-primary-soft font-bold text-primary-text' : 'border-border-control text-foreground hover:bg-surface-tint hover:text-primary-text'
                      }`
                    : `flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-pequeno transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-text ${
                        selecionado ? 'bg-primary-soft font-bold text-primary-text' : 'text-foreground hover:bg-surface-tint hover:text-primary-text'
                      }`
                }
              >
                <span className="flex flex-col">
                  {item.rotulo}
                  {descricoes?.[item.valor] && <span className="text-legenda font-normal text-text-muted">{descricoes[item.valor]}</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {limite && itens.length > limite + 1 && indiceAtivo < limite && (
        <button
          type="button"
          aria-expanded={todas}
          onClick={() => setTodas((v) => !v)}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-pequeno font-semibold text-primary-text hover:bg-surface-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-text"
        >
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${todas ? 'rotate-180' : ''}`} />
          {todas ? 'Mostrar menos' : `Mostrar todas (${itens.filter((i) => i.valor).length})`}
        </button>
      )}
    </fieldset>
  )
}

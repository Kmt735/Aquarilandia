import { useCallback, useEffect, useMemo, useState } from 'react'
import useToast from '../hooks/useToast'
import useUI from '../hooks/useUI'
import { precoEmCentavos } from '../utils/dinheiro'
import { plural } from '../utils/format'
import { CartContext } from './contexts'

const CHAVE = 'aquarilandia-carrinho'

function lerCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) ?? []
  } catch {
    return []
  }
}

// Guarda uma "foto" do item (nome, preço, estoque, tipo) no momento em que entra no carrinho,
// como a API fará. Item 30 · memória: o carrinho é lembrado entre visitas.
export default function CartProvider({ children }) {
  const [linhas, setLinhas] = useState(lerCarrinho) // [{ id, qtd, item }]
  const [bump, setBump] = useState(0)
  const { toast } = useToast()
  const { abrirPainel } = useUI()

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(linhas))
    } catch {
      // armazenamento bloqueado: o carrinho vale só nesta visita
    }
  }, [linhas])

  // Item 5 · não é possível adicionar mais unidades do que há em estoque
  const adicionar = useCallback(
    (item, qtd = 1) => {
      if (item.disponibilidade === 'esgotado') return
      const atual = linhas.find((l) => l.id === item.id)?.qtd ?? 0
      const maximo = item.estoque ?? Infinity
      const nova = Math.min(atual + qtd, maximo)

      if (nova === atual) {
        toast(`Você já tem ${plural(atual, 'unidade')} de ${item.nome} no carrinho, o máximo disponível.`, {
          tipo: 'erro',
          acao: 'Ver carrinho',
          onAcao: () => abrirPainel('carrinho'),
        })
        return
      }
      setLinhas((lista) =>
        lista.some((l) => l.id === item.id)
          ? lista.map((l) => (l.id === item.id ? { ...l, qtd: nova, item } : l))
          : [...lista, { id: item.id, qtd: nova, item }],
      )
      setBump((b) => b + 1)
      // Item 38 · retorno imediato, sem tirar o usuário da página
      const extra = nova - atual < qtd ? ` (só havia ${maximo} em estoque)` : ''
      toast(`${item.nome} adicionado ao carrinho${extra}.`, {
        tipo: 'sucesso',
        acao: 'Ver carrinho',
        onAcao: () => abrirPainel('carrinho'),
      })
    },
    [linhas, toast, abrirPainel],
  )

  const definirQtd = useCallback((id, qtd) => {
    setLinhas((lista) =>
      lista.map((l) => (l.id === id ? { ...l, qtd: Math.max(1, Math.min(qtd, l.item.estoque ?? Infinity)) } : l)),
    )
  }, [])

  // Item 3 · controle do usuário: remover sempre oferece "Desfazer"
  const remover = useCallback(
    (id) => {
      const indice = linhas.findIndex((l) => l.id === id)
      if (indice < 0) return
      const removida = linhas[indice]
      setLinhas((lista) => lista.filter((l) => l.id !== id))
      toast(`${removida.item.nome} removido do carrinho.`, {
        tipo: 'info',
        acao: 'Desfazer',
        onAcao: () => {
          setLinhas((lista) => {
            const nova = [...lista]
            nova.splice(Math.min(indice, nova.length), 0, removida)
            return nova
          })
          setBump((b) => b + 1)
        },
      })
    },
    [linhas, toast],
  )

  const limpar = useCallback(() => setLinhas([]), [])

  const value = useMemo(
    () => ({
      linhas,
      bump,
      quantidade: linhas.reduce((s, l) => s + l.qtd, 0),
      // Compatibilidade dos componentes de frete/checkout do protótipo (valores em reais).
      total: linhas.reduce((s, l) => s + precoEmCentavos(l.item) * l.qtd, 0) / 100,
      temPeixe: linhas.some((l) => l.item.tipo === 'peixe'),
      qtdNoCarrinho: (id) => linhas.find((l) => l.id === id)?.qtd ?? 0,
      adicionar,
      definirQtd,
      remover,
      limpar,
    }),
    [linhas, bump, adicionar, definirQtd, remover, limpar],
  )

  return <CartContext value={value}>{children}</CartContext>
}

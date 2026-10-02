import { useCallback, useMemo, useState } from 'react'
import { buscarProduto } from '../data/produtos'
import useToast from '../hooks/useToast'
import useUI from '../hooks/useUI'
import { CartContext } from './contexts'

export default function CartProvider({ children }) {
  const [itens, setItens] = useState([]) // [{ id, qtd }]
  const [bump, setBump] = useState(0)
  const { toast } = useToast()
  const { abrirPainel } = useUI()

  const alterarQtd = (id, delta) =>
    setItens((lista) => lista.map((i) => (i.id === id ? { ...i, qtd: i.qtd + delta } : i)))

  const adicionar = useCallback(
    (produto) => {
      setItens((lista) =>
        lista.some((i) => i.id === produto.id)
          ? lista.map((i) => (i.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i))
          : [...lista, { id: produto.id, qtd: 1 }],
      )
      setBump((b) => b + 1)
      toast(`✓ ${produto.nome} adicionado ao carrinho`, {
        acao: 'Ver carrinho',
        onAcao: () => abrirPainel('carrinho'),
      })
    },
    [toast, abrirPainel],
  )

  // H3 · Controle do usuário: remover sempre oferece "Desfazer"
  const remover = useCallback(
    (id) => {
      const indice = itens.findIndex((i) => i.id === id)
      if (indice < 0) return
      const removido = itens[indice]
      setItens((lista) => lista.filter((i) => i.id !== id))
      toast(`${buscarProduto(id).nome} removido`, {
        acao: 'Desfazer',
        duracao: 5000,
        onAcao: () => {
          setItens((lista) => {
            const nova = [...lista]
            nova.splice(Math.min(indice, nova.length), 0, removido)
            return nova
          })
          setBump((b) => b + 1)
        },
      })
    },
    [itens, toast],
  )

  const incrementar = useCallback((id) => alterarQtd(id, 1), [])
  const decrementar = useCallback(
    (id) => {
      const item = itens.find((i) => i.id === id)
      if (!item) return
      if (item.qtd > 1) alterarQtd(id, -1)
      else remover(id)
    },
    [itens, remover],
  )

  const value = useMemo(() => {
    const linhas = itens.map((i) => ({ ...i, produto: buscarProduto(i.id) }))
    return {
      linhas,
      bump,
      quantidade: linhas.reduce((s, l) => s + l.qtd, 0),
      total: linhas.reduce((s, l) => s + l.produto.preco * l.qtd, 0),
      adicionar,
      remover,
      incrementar,
      decrementar,
    }
  }, [itens, bump, adicionar, remover, incrementar, decrementar])

  return <CartContext value={value}>{children}</CartContext>
}

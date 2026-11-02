import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'
import Button from '../atoms/Button'
import EmptyState from '../molecules/EmptyState'
import { CHAVE_CARRINHO } from '../../services/carrinho'

// Fica fora do roteador e dos providers: se algum deles quebrar, ainda há algo para mostrar no lugar da tela branca.
export default class ErrorBoundary extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('Erro inesperado na interface:', erro, info?.componentStack)
  }

  // Um carrinho salvo corrompido é a causa mais provável que o próprio usuário consegue resolver
  limparCarrinhoERecarregar = () => {
    try {
      localStorage.removeItem(CHAVE_CARRINHO)
    } catch {
      // armazenamento bloqueado: recarregar já é o melhor que dá para fazer
    }
    window.location.reload()
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 desk:px-10">
        <h1 className="sr-only">Algo deu errado</h1>
        <EmptyState
          tom="erro"
          icone={<TriangleAlert />}
          titulo="Algo deu errado por aqui"
          acoes={
            <>
              <Button onClick={() => window.location.reload()}>Recarregar a página</Button>
              <Button variant="secundario" onClick={this.limparCarrinhoERecarregar}>
                Esvaziar carrinho e recarregar
              </Button>
              <Button variant="terciario" asChild>
                <a href="/">Ir para a Início</a>
              </Button>
            </>
          }
        >
          A página encontrou um erro inesperado. Recarregar costuma resolver. Se o problema continuar, esvaziar o carrinho
          salvo neste navegador também pode ajudar.
        </EmptyState>
      </main>
    )
  }
}

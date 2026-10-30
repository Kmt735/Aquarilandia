import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../components/atoms/Button'
import EmptyState from '../components/molecules/EmptyState'
import useTituloPagina from '../hooks/useTituloPagina'
import useUI from '../hooks/useUI'
import { ROTAS } from '../utils/rotas'

// Antes, um endereço errado voltava em silêncio para a Início. Agora explica e oferece saídas (item 9).
export default function NaoEncontradaPage() {
  useTituloPagina('Página não encontrada')
  const { abrirPainel } = useUI()
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 desk:px-10">
      <h1 className="sr-only">Página não encontrada</h1>
      <EmptyState
        icone={<Compass />}
        titulo="Essa página não existe"
        acoes={
          <>
            <Button asChild>
              <Link to={ROTAS.inicio}>Ir para a Início</Link>
            </Button>
            <Button variant="secundario" onClick={() => abrirPainel('busca')}>
              Buscar no site
            </Button>
          </>
        }
      >
        O endereço pode ter mudado ou estar com algum erro de digitação.
      </EmptyState>
    </div>
  )
}

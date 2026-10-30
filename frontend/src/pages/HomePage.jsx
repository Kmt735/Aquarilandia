import CategoryBand from '../components/organisms/CategoryBand'
import ConfiancaLoja from '../components/organisms/ConfiancaLoja'
import GuideCta from '../components/organisms/GuideCta'
import Hero from '../components/organisms/Hero'
import ServicesPreview from '../components/organisms/ServicesPreview'
import Vitrine from '../components/organisms/Vitrine'
import useConsulta from '../hooks/useConsulta'
import useTituloPagina from '../hooks/useTituloPagina'
import { listarPeixes } from '../services/catalogo'
import { ROTAS } from '../utils/rotas'

// Início mais curta, com UMA ação principal por seção (itens 8, 19, 29, 37):
// hero → categorias → peixes → guia do iniciante → serviços → confiança → rodapé
export default function HomePage() {
  useTituloPagina(null)
  const peixes = useConsulta(async () => (await listarPeixes()).filter((p) => p.disponibilidade !== 'esgotado'))

  return (
    <>
      <Hero />
      <CategoryBand />
      <Vitrine
        id="titulo-peixes"
        eyebrow="Vitrine"
        titulo="Peixes em destaque"
        descricao="Cada card mostra temperamento, aquário mínimo e temperatura, para você escolher com segurança."
        consulta={peixes}
        verTodos={{ to: ROTAS.peixes, rotulo: 'Ver todos os peixes', descricao: 'Filtre por tipo de água, temperamento e dificuldade.' }}
      />
      <GuideCta />
      <div className="h-14 desk:h-20" />
      <ServicesPreview />
      <ConfiancaLoja />
    </>
  )
}

import { BookOpen, ChevronDown } from 'lucide-react'
import { Link } from 'react-router'
import { DicasPeixes, ItemEquipamento } from './GuiaConteudo'
import { parametrosAgua, passosGuia } from '../../data/guia'
import { ROTAS } from '../../utils/rotas'

// "Saiba mais" de cada etapa do montador: o mesmo conteúdo do guia (data/guia.js), sem cópia.
// Recolhido por padrão para não atrapalhar quem já sabe; <details> é acessível por teclado sem script.
const ideal = (id) => parametrosAgua.find((p) => p.id === id)
const tituloPasso = (id) => passosGuia.find((p) => p.id === id).titulo

const CONTEUDO = {
  aquario: {
    resumo: 'Como escolher o tamanho',
    passos: ['equipamentos', 'escolha-dos-peixes'],
    corpo: () => (
      <>
        <ItemEquipamento id="aquario" compacto nivel={4} />
        <DicasPeixes compacto nivel={4} ids={['tamanho']} />
      </>
    ),
  },
  equipamentos: {
    resumo: 'Para que serve cada equipamento',
    passos: ['equipamentos', 'qualidade-da-agua'],
    corpo: () => (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          {['filtro', 'termostato', 'iluminacao'].map((id) => <ItemEquipamento key={id} id={id} compacto nivel={4} />)}
        </div>
        <p className="text-pequeno text-text-muted">
          <strong className="text-foreground">Temperatura ideal:</strong> {ideal('temperatura').ideal}. {ideal('temperatura').significado}
        </p>
      </>
    ),
  },
  substrato: {
    resumo: 'O que é o substrato',
    passos: ['equipamentos'],
    corpo: () => <ItemEquipamento id="substrato" compacto nivel={4} />,
  },
  peixes: {
    resumo: 'Dicas para escolher os peixes',
    passos: ['escolha-dos-peixes', 'ciclagem', 'qualidade-da-agua'],
    corpo: () => (
      <>
        <DicasPeixes compacto nivel={4} />
        {/* A ciclagem já tem aviso próprio na etapa (BuilderEtapas); aqui só a água ideal, do guia */}
        <p className="text-pequeno text-text-muted">
          <strong className="text-foreground">Água ideal para a maioria dos peixes tropicais:</strong> pH {ideal('ph').ideal}, temperatura {ideal('temperatura').ideal}.
        </p>
      </>
    ),
  },
}

export default function SaibaMaisEtapa({ etapa }) {
  const conteudo = CONTEUDO[etapa]
  if (!conteudo) return null
  const Corpo = conteudo.corpo
  return (
    <details className="group mb-6 rounded-card border border-border-strong bg-surface-tint">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-card px-4 py-2 text-pequeno font-bold text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-text [&::-webkit-details-marker]:hidden">
        <BookOpen aria-hidden="true" className="size-4 shrink-0" />
        <span className="flex-1">Saiba mais: {conteudo.resumo}</span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 pt-4 pb-4">
        <Corpo />
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-pequeno">
          {conteudo.passos.map((id) => (
            <Link key={id} to={`${ROTAS.primeiroAquario}#${id}`} className="alvo-toque inline-flex items-center font-bold text-primary-text underline decoration-2 underline-offset-4">
              Ler no guia: {tituloPasso(id)}
            </Link>
          ))}
        </p>
      </div>
    </details>
  )
}

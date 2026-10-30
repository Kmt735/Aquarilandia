import { Trilha } from '../molecules/PageHead'
import useTituloPagina from '../../hooks/useTituloPagina'

// Telas de conta (entrar, criar conta, senha): um cartão central, uma tarefa por tela
export default function FormTemplate({ titulo, descricao, trilha, children, rodape }) {
  useTituloPagina(titulo)
  return (
    <div className="luz-luminaria bg-surface-tint">
      <div className="mx-auto max-w-[480px] px-4 py-10 desk:py-16">
        {trilha && <Trilha itens={trilha} />}
        <div className="rounded-faixa border border-border-strong bg-surface p-6 shadow-soft sm:p-8">
          <h1 className="text-h2">{titulo}</h1>
          {descricao && <p className="mt-2 text-corpo text-text-muted">{descricao}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {rodape && <div className="mt-6 text-center text-pequeno text-text-muted">{rodape}</div>}
      </div>
    </div>
  )
}

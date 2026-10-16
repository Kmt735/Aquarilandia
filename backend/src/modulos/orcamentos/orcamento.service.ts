import { randomUUID } from 'node:crypto'
import { opcoesServico } from '../../data/servicos.js'
import type { NovoOrcamento, Orcamento } from '../../types/index.js'
import { AppError } from '../../utils/AppError.js'

const orcamentos: Orcamento[] = []

// Mesmas regras do formulário do frontend
function validar(dados: Partial<NovoOrcamento>): NovoOrcamento {
  const erros: Record<string, string> = {}
  const nome = String(dados.nome ?? '').trim()
  const telefone = String(dados.telefone ?? '').trim()
  const servico = String(dados.servico ?? '').trim()
  const mensagem = dados.mensagem ? String(dados.mensagem).trim() : undefined
  const digitos = telefone.replace(/\D/g, '').length

  if (nome.length < 2) erros.nome = 'Digite seu nome (pelo menos 2 letras).'
  if (digitos !== 10 && digitos !== 11) erros.telefone = 'Telefone incompleto. Exemplo: (32) 99999-0000'
  if (!opcoesServico.includes(servico)) erros.servico = 'Escolha um serviço da lista.'

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { nome, telefone, servico, mensagem }
}

export const orcamentoService = {
  criar(dados: Partial<NovoOrcamento>): Orcamento {
    const orcamento: Orcamento = { id: randomUUID(), criadoEm: new Date().toISOString(), ...validar(dados) }
    orcamentos.push(orcamento)
    return orcamento
  },

  listar: () => orcamentos,
}

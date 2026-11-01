import { opcoesServico } from '../../data/servicos.js'
import { AppError } from '../../utils/AppError.js'
import { paginacao } from '../../utils/validacao.js'
import { orcamentoRepository } from './orcamento.repository.js'
import type { ListaOrcamentos, NovoOrcamento, Orcamento, StatusOrcamento } from './orcamento.types.js'

const statusValidos: readonly StatusOrcamento[] = ['novo', 'em_atendimento', 'concluido']
const msgStatusInvalido = 'Escolha um status válido: novo, em_atendimento ou concluido.'

// Sem trim nem conversão: só os 3 textos exatos passam (mesma lição do aceiteTermos)
function ehStatus(valor: unknown): valor is StatusOrcamento {
  return typeof valor === 'string' && (statusValidos as readonly string[]).includes(valor)
}

// Mesmas regras e mensagens do formulário do frontend. Os máximos são os tamanhos das colunas (15_orcamentos.sql).
// Lê só nome, telefone, servico e mensagem: id, status, criadoEm etc. vindos do body são ignorados.
function validar(body: unknown): NovoOrcamento {
  const dados = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const erros: Record<string, string> = {}
  const nome = String(dados.nome ?? '').trim()
  const telefone = String(dados.telefone ?? '').replace(/\D/g, '')
  const servico = String(dados.servico ?? '').trim()
  const mensagem = dados.mensagem ? String(dados.mensagem).trim() || null : null

  if (nome.length < 2 || nome.length > 120) erros.nome = 'Digite seu nome (pelo menos 2 letras).'
  if (telefone.length !== 10 && telefone.length !== 11) erros.telefone = 'Telefone incompleto. Exemplo: (32) 99999-0000'
  if (!opcoesServico.includes(servico)) erros.servico = 'Escolha um serviço da lista.'
  if (mensagem && mensagem.length > 1000) erros.mensagem = 'A mensagem pode ter até 1000 caracteres.'

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { nome, telefone, servico, mensagem }
}

// Só os campos do pedido saem na resposta, mesmo que o registro venha com algo a mais
function paraResposta(orcamento: Orcamento): Orcamento {
  const { id, nome, telefone, servico, mensagem, status, criadoEm, atualizadoEm } = orcamento
  return { id, nome, telefone, servico, mensagem, status, criadoEm, atualizadoEm }
}

export const orcamentoService = {
  async criar(body: unknown): Promise<Orcamento> {
    return paraResposta(await orcamentoRepository.inserir(validar(body)))
  },

  async listar(query: unknown): Promise<ListaOrcamentos> {
    const parametros = (typeof query === 'object' && query !== null ? query : {}) as Record<string, unknown>
    const { pagina, limite } = paginacao(parametros)

    let status: StatusOrcamento | undefined
    if (parametros.status !== undefined) {
      if (!ehStatus(parametros.status)) throw new AppError('Parâmetros inválidos', 400, { status: msgStatusInvalido })
      status = parametros.status
    }

    const { dados, total } = await orcamentoRepository.listar({ status, limite, offset: (pagina - 1) * limite })
    return { dados: dados.map(paraResposta), total, pagina, limite }
  },
}

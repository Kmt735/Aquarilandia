// INTEGRAÇÃO: POST /api/orcamentos ({ nome, telefone, servico, mensagem? }) — rota já existe no backend.
// Nesta tarefa a API não é chamada: o envio é simulado.
import { ErroApi, simularRede } from './http'
import { regras, validar } from '../utils/validacao'

export async function enviarOrcamento(dados) {
  const detalhes = validar(dados, { nome: regras.nome, telefone: regras.telefone, servico: regras.servico })
  if (Object.keys(detalhes).length) throw new ErroApi('Confira os campos destacados.', detalhes)
  await simularRede(700)
  return { ok: true }
}

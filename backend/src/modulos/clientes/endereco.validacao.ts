import { AppError } from '../../utils/AppError.js'
import type { AtualizacaoEndereco, NovoEndereco } from './cliente.types.js'

export const ufsValidas: readonly string[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

type CampoEndereco = keyof NovoEndereco

interface ResultadoCampo<K extends CampoEndereco> {
  valor: NovoEndereco[K]
  erro: string | null
}

interface ResultadoTexto {
  valor: string
  erro: string | null
}

function textoOpcional(valor: unknown): string | null {
  return String(valor ?? '').trim() || null
}

function texto(valor: unknown, minimo: number, maximo: number, mensagem: string): ResultadoTexto {
  const normalizado = String(valor ?? '').trim()
  const erro = normalizado.length < minimo || normalizado.length > maximo ? mensagem : null
  return { valor: normalizado, erro }
}

// Uma regra por campo, usada pelo POST (modo completo) e pelo PATCH (modo parcial).
// Recebe o valor cru do body e devolve o valor normalizado e a mensagem de erro (ou null).
const regras: { [K in CampoEndereco]: (valor: unknown) => ResultadoCampo<K> } = {
  apelido: (valor) => {
    const apelido = textoOpcional(valor)
    return { valor: apelido, erro: apelido && apelido.length > 40 ? 'O apelido pode ter até 40 caracteres.' : null }
  },
  cep: (valor) => {
    const cep = String(valor ?? '').replace(/\D/g, '')
    return { valor: cep, erro: cep.length !== 8 ? 'Digite um CEP válido com 8 números. Exemplo: 36300-000.' : null }
  },
  logradouro: (valor) => texto(valor, 2, 150, 'Digite a rua (de 2 a 150 caracteres).'),
  numero: (valor) => texto(valor, 1, 10, 'Digite o número (até 10 caracteres). Se não houver, use S/N.'),
  complemento: (valor) => {
    const complemento = textoOpcional(valor)
    return {
      valor: complemento,
      erro: complemento && complemento.length > 80 ? 'O complemento pode ter até 80 caracteres.' : null,
    }
  },
  bairro: (valor) => texto(valor, 2, 80, 'Digite o bairro (de 2 a 80 caracteres).'),
  cidade: (valor) => texto(valor, 2, 80, 'Digite a cidade (de 2 a 80 caracteres).'),
  uf: (valor) => {
    const uf = String(valor ?? '').trim().toUpperCase()
    return { valor: uf, erro: ufsValidas.includes(uf) ? null : 'Escolha um estado válido. Exemplo: MG.' }
  },
  // Sem Boolean(): "sim", 1 e "true" (texto) virariam true sem o cliente ter marcado nada
  principal: (valor) => {
    if (valor === undefined) return { valor: false, erro: null }
    if (typeof valor !== 'boolean') return { valor: false, erro: 'Valor inválido para endereço principal.' }
    return { valor, erro: null }
  },
}

// A lista fixa de chaves lidas do body: id, clienteId, criadoEm etc. nunca entram no resultado
const camposEndereco = Object.keys(regras) as CampoEndereco[]

function validarCampo<K extends CampoEndereco>(
  campo: K,
  valor: unknown,
  destino: AtualizacaoEndereco,
  erros: Record<string, string>,
): void {
  const resultado = regras[campo](valor)
  if (resultado.erro) erros[campo] = resultado.erro
  destino[campo] = resultado.valor
}

function lerObjeto(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }
  return body as Record<string, unknown>
}

function lerCampos(dados: Record<string, unknown>, campos: CampoEndereco[]): AtualizacaoEndereco {
  const erros: Record<string, string> = {}
  const endereco: AtualizacaoEndereco = {}
  for (const campo of campos) validarCampo(campo, dados[campo], endereco, erros)
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return endereco
}

// POST: todos os campos passam pela regra; os que faltam viram '' e caem na validação de tamanho
// (apelido, complemento e principal aceitam ficar de fora)
export function validarEndereco(body: unknown): NovoEndereco {
  // lerCampos percorreu as 9 chaves, então nenhuma ficou undefined
  return lerCampos(lerObjeto(body), camposEndereco) as NovoEndereco
}

// PATCH: só valida e só devolve os campos que vieram no body
export function validarAtualizacaoEndereco(body: unknown): AtualizacaoEndereco {
  const dados = lerObjeto(body)
  const campos = camposEndereco.filter((campo) => dados[campo] !== undefined)
  if (!campos.length) {
    throw new AppError('Dados inválidos', 422, { body: 'Informe pelo menos um campo do endereço para atualizar.' })
  }
  return lerCampos(dados, campos)
}

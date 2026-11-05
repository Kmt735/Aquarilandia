import type{ NextFunction, Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { normalizarEmail } from '../modulos/clientes/cliente.validacao.js'
import { AppError } from '../utils/AppError.js'

const msgMuitasTentativas = 'Muitas tentativas. Tente de novo em alguns minutos. '

function responderLimite(_req: Request, _res: Response, next: NextFunction): void{
    next(new AppError(msgMuitasTentativas, 429))
}

export const limiteLogin = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

export const limiteCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

// Formulário público de orçamento: sem skipSuccessfulRequests, porque o abuso é mandar pedidos VÁLIDOS em massa
export const limiteOrcamento = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

// Quem roubar uma sessão não pode testar senhas atuais sem limite
export const limiteTrocaSenha = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

// Esqueci a senha, por IP: conta TODOS os pedidos (sem skipSuccessfulRequests), porque o abuso aqui é mandar
// muitos e-mails, e cada pedido "certo" manda um
export const limiteEsqueciSenhaIp = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

// Mesma chave que o service usa para achar a conta. Body sem e-mail (ou que não é objeto) cai todo numa chave só.
// Não usa o IP de propósito: a validação ERR_ERL_KEY_GEN_IPV6 da biblioteca só vale para chave feita com o IP
function chavePorEmail(req: Request): string {
  const body: unknown = req.body
  if (typeof body !== 'object' || body === null) return 'sem-email'
  const email = normalizarEmail((body as Record<string, unknown>).email)
  return email === '' ? 'sem-email' : email
}

// Esqueci a senha, por e-mail: impede encher a caixa de entrada de uma pessoa trocando de IP.
// Vem depois do limite por IP: cada IP cria no máximo 3 chaves por hora aqui, então a memória não dispara
export const limiteEsqueciSenhaEmail = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: chavePorEmail,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

// Redefinir a senha: conta todos os pedidos. Limita as tentativas de token e o argon2 que roda a cada pedido
export const limiteRedefinirSenha = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

// Cotação de frete (pública, sem login): conta todos os pedidos, por IP. Cada cotação consulta o catálogo,
// então o limite segura quem tenta varrer CEPs ou produtos em massa
export const limiteFrete = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

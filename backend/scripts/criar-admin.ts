// Cria um admin (D-06: admin só nasce por aqui, nunca por rota HTTP).
// Uso seguro — a senha vem de variável de ambiente, fora da lista de processos e do histórico:
//   read -s -p "Senha do admin: " SENHA_ADMIN && echo
//   SENHA_ADMIN="$SENHA_ADMIN" npm run criar-admin -- --nome "Loja Aquarilândia" --email admin@aquarilandia.dev
//   unset SENHA_ADMIN
// O --senha também funciona, mas fica visível no histórico do shell, no `ps` e no cabeçalho que o
// `npm run` imprime (esse último some com `npm run -s`).
import { parseArgs } from 'node:util'
import { db } from '../src/config/db.js'
import { authService } from '../src/modulos/auth/auth.service.js'
import { AppError } from '../src/utils/AppError.js'

try {
  const { values } = parseArgs({
    options: {
      nome: { type: 'string' },
      email: { type: 'string' },
      senha: { type: 'string' },
    },
  })

  const admin = await authService.criarAdmin({
    nome: values.nome,
    email: values.email,
    senha: process.env.SENHA_ADMIN ?? values.senha,
  })
  console.log(`Admin criado: id ${admin.id}, ${admin.email}`)
} catch (err) {
  if (err instanceof AppError) {
    console.error(err.message)
    for (const [campo, mensagem] of Object.entries(err.detalhes ?? {})) console.error(`- ${campo}: ${mensagem}`)
  } else {
    // Só mensagem e código: o `detail` de um erro do Postgres pode trazer a linha recusada, com o senha_hash
    const codigo = typeof err === 'object' && err !== null && 'code' in err ? ` (${String(err.code)})` : ''
    console.error(`Erro inesperado${codigo}:`, err instanceof Error ? err.message : err)
  }
  process.exitCode = 1
} finally {
  await db.end()
}

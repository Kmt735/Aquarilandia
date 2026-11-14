// Dados de demonstração (#14, Lote 13): 1 admin, 1 cliente com endereço em São João del Rei, 3 categorias e 8 produtos
// de exemplo (2 peixes) com estoque. Usa SÓ as rotas da API (nenhum SQL); o admin nasce pelo criar-admin (D-06: admin
// nunca nasce por rota HTTP). Idempotente: confere antes de criar, então rodar duas vezes não duplica nada.
// Imprime só os e-mails e o que foi criado; nunca senha, cookie ou token.
//
// Uso (as senhas vêm de variável, fora do histórico do shell: read -s SENHA_ADMIN e read -s SENHA_CLIENTE):
//   desenvolvimento, com o backend rodando:
//     API_URL=http://localhost:3333 SENHA_ADMIN="$SENHA_ADMIN" SENHA_CLIENTE="$SENHA_CLIENTE" \
//       npx tsx --env-file-if-exists=.env scripts/dados-demo.ts
//   produção, dentro do container da app (docs/deploy.md). Lá o API_URL é o endereço público da app (o env.ts de
//   produção exige https://, e o criar-admin carrega o env.ts), então o endereço interno vai no DEMO_API_URL:
//     docker compose --env-file .env.producao -f docker-compose.prod.yml exec -e DEMO_API_URL=http://localhost:3333 \
//       -e SENHA_ADMIN -e SENHA_CLIENTE app node dist-scripts/scripts/dados-demo.js
// O endereço da API: DEMO_API_URL, ou o API_URL. Opcionais: DEMO_ADMIN_EMAIL, DEMO_CLIENTE_EMAIL e ORIGEM (padrão: o
// CORS_ORIGIN do ambiente, ou a origem do endereço da API).
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type Json = Record<string, unknown>
interface Resposta { status: number; corpo: Json }

function obrigatoria(nome: string): string {
  const valor = process.env[nome]
  if (!valor || valor.trim() === '') throw new Error(`Defina ${nome} (veja o topo de scripts/dados-demo.ts).`)
  return valor
}

const apiUrl = (process.env.DEMO_API_URL ?? obrigatoria('API_URL')).replace(/\/+$/, '')
const base = `${apiUrl}/api`
const origem = process.env.ORIGEM ?? process.env.CORS_ORIGIN ?? new URL(apiUrl).origin
const adminEmail = process.env.DEMO_ADMIN_EMAIL ?? 'admin.demo@exemplo.com'
const clienteEmail = process.env.DEMO_CLIENTE_EMAIL ?? 'cliente.demo@exemplo.com'
const senhaAdmin = obrigatoria('SENHA_ADMIN')
const senhaCliente = obrigatoria('SENHA_CLIENTE')

// Pedido à API. sessao = o cookie sid (só em memória). Nunca imprime o corpo inteiro nem cabeçalhos
async function pedir(metodo: string, caminho: string, opcoes: { body?: unknown; sessao?: string; chave?: string } = {}): Promise<Resposta> {
  const headers: Record<string, string> = { Origin: origem, Accept: 'application/json' }
  if (opcoes.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opcoes.sessao) headers.Cookie = `sid=${opcoes.sessao}`
  if (opcoes.chave) headers['Idempotency-Key'] = opcoes.chave
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
  })
  const texto = await r.text()
  return { status: r.status, corpo: texto ? JSON.parse(texto) as Json : {} }
}

// Erro com o status e a mensagem da API (as mensagens são nossas, sem dados), nunca o corpo do pedido
function exigir(r: Resposta, esperados: number[], oQue: string): void {
  if (esperados.includes(r.status)) return
  const detalhes = r.corpo.detalhes ? ` ${JSON.stringify(r.corpo.detalhes)}` : ''
  throw new Error(`${oQue}: HTTP ${r.status} ${String(r.corpo.erro ?? '')}${detalhes}`)
}

// Login: devolve o cookie sid, ou null com 401 (conta ainda não existe ou senha errada)
async function entrar(email: string, senha: string): Promise<string | null> {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { Origin: origem, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  if (r.status === 401) return null
  if (!r.ok) throw new Error(`login de ${email}: HTTP ${r.status}`)
  const sid = r.headers.getSetCookie().map((c) => /^sid=([^;]+)/.exec(c)?.[1]).find(Boolean)
  if (!sid) throw new Error(`login de ${email}: resposta sem o cookie de sessão`)
  return sid
}

function semVariaveisDoScript(ambiente: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { DEMO_API_URL: _url, SENHA_CLIENTE: _senha, ...resto } = ambiente
  return resto
}

// O criar-admin roda ao lado deste script: compilado (node .js, no container) ou com o tsx (desenvolvimento).
// A senha vai pelo ambiente (SENHA_ADMIN), nunca pela linha de comando
function criarAdmin(): void {
  const pasta = dirname(fileURLToPath(import.meta.url))
  const compilado = import.meta.url.endsWith('.js')
  const [comando, args] = compilado
    ? [process.execPath, [join(pasta, 'criar-admin.js')]]
    : ['npx', ['tsx', '--env-file-if-exists=.env', join(pasta, 'criar-admin.ts')]]
  const processo = spawnSync(comando, [...args, '--nome', 'Admin Demonstração', '--email', adminEmail], {
    cwd: join(pasta, '..'),
    // O ambiente da app como ele é (sem o DEMO_API_URL nem a senha do cliente), mais a senha do admin
    env: { ...semVariaveisDoScript(process.env), SENHA_ADMIN: senhaAdmin },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
  if (processo.status !== 0) throw new Error(`criar-admin falhou: ${processo.stderr.trim().split('\n')[0] ?? ''}`)
}

// Chave de idempotência fixa por produto (UUID versão 8, variante RFC): a mesma entrada de estoque nunca entra duas
// vezes, nem se o script for interrompido entre o pedido e a resposta
function chaveDaEntrada(produtoId: number): string {
  const h = createHash('sha256').update(`dados-demo:entrada:${produtoId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

const categorias = [
  { slug: 'peixes', nome: 'Peixes' },
  { slug: 'racoes', nome: 'Rações' },
  { slug: 'acessorios', nome: 'Acessórios' },
]

interface ProdutoDemo { categoria: string; nome: string; descricao: string; marca: string | null; preco: number; estoque: number; ficha?: { tipo: string; dados: Json } }

const produtos: ProdutoDemo[] = [
  {
    categoria: 'peixes', nome: 'Neon (demonstração)', descricao: 'Peixe de cardume, tranquilo e colorido.', marca: null, preco: 890, estoque: 30,
    ficha: { tipo: 'peixes', dados: { nomeCientifico: 'Paracheirodon innesi', tipoAgua: 'doce', tamanhoAdultoCm: 3.5, tempMinC: 22, tempMaxC: 26,
      phMin: 5.5, phMax: 7, aquarioMinLitros: 40, temperamento: 'pacifico', cardumeMinimo: 6, dificuldade: 'iniciante' } },
  },
  {
    categoria: 'peixes', nome: 'Betta (demonstração)', descricao: 'Peixe de nadadeiras longas; um macho por aquário.', marca: null, preco: 2490, estoque: 8,
    ficha: { tipo: 'peixes', dados: { nomeCientifico: 'Betta splendens', tipoAgua: 'doce', tamanhoAdultoCm: 6.5, tempMinC: 24, tempMaxC: 28,
      phMin: 6, phMax: 7.5, aquarioMinLitros: 20, temperamento: 'semi_agressivo', cardumeMinimo: 1, dificuldade: 'iniciante' } },
  },
  { categoria: 'racoes', nome: 'Ração em flocos 50 g (demonstração)', descricao: 'Para peixes tropicais de água doce.', marca: 'Marca Exemplo', preco: 1990, estoque: 20,
    ficha: { tipo: 'racoes', dados: { formato: 'flocos', pesoG: 50, tipoAgua: 'doce' } } },
  { categoria: 'racoes', nome: 'Ração em grânulos 100 g (demonstração)', descricao: 'Grânulos que afundam devagar.', marca: 'Marca Exemplo', preco: 2790, estoque: 15,
    ficha: { tipo: 'racoes', dados: { formato: 'granulos', pesoG: 100, tipoAgua: 'doce' } } },
  { categoria: 'racoes', nome: 'Ração marinha 40 g (demonstração)', descricao: 'Para peixes de água salgada.', marca: 'Marca Exemplo', preco: 3490, estoque: 10,
    ficha: { tipo: 'racoes', dados: { formato: 'flocos', pesoG: 40, tipoAgua: 'marinho' } } },
  { categoria: 'acessorios', nome: 'Rede para peixes (demonstração)', descricao: 'Rede de malha fina, 10 cm.', marca: null, preco: 1290, estoque: 25 },
  { categoria: 'acessorios', nome: 'Termômetro de vidro (demonstração)', descricao: 'Com ventosa, de 0 a 40 °C.', marca: null, preco: 1590, estoque: 25 },
  { categoria: 'acessorios', nome: 'Sifão de limpeza (demonstração)', descricao: 'Para limpar o substrato na troca parcial de água.', marca: null, preco: 3990, estoque: 12 },
]

async function principal(): Promise<void> {
  // ---------- admin ----------
  let admin = await entrar(adminEmail, senhaAdmin)
  if (admin) {
    console.log(`Admin: ${adminEmail} (já existia)`)
  } else {
    criarAdmin()
    admin = await entrar(adminEmail, senhaAdmin)
    if (!admin) throw new Error('o admin foi criado, mas o login falhou')
    console.log(`Admin: ${adminEmail} (criado)`)
  }

  // ---------- cliente com endereço em São João del Rei ----------
  let cliente = await entrar(clienteEmail, senhaCliente)
  if (cliente) {
    console.log(`Cliente: ${clienteEmail} (já existia)`)
  } else {
    const r = await pedir('POST', '/auth/cadastro', {
      body: { nome: 'Cliente Demonstração', email: clienteEmail, senha: senhaCliente, telefone: '32999990000', aceiteTermos: true },
    })
    exigir(r, [201], 'cadastro do cliente')
    cliente = await entrar(clienteEmail, senhaCliente)
    if (!cliente) throw new Error('o cliente foi cadastrado, mas o login falhou')
    console.log(`Cliente: ${clienteEmail} (criado)`)
  }
  const enderecos = await pedir('GET', '/clientes/me/enderecos', { sessao: cliente })
  exigir(enderecos, [200], 'endereços do cliente')
  if (Array.isArray(enderecos.corpo) && enderecos.corpo.length > 0) {
    console.log('Endereço do cliente: já existia')
  } else {
    const r = await pedir('POST', '/clientes/me/enderecos', {
      sessao: cliente,
      body: { apelido: 'Casa', cep: '36300000', logradouro: 'Rua Getúlio Vargas', numero: '100', bairro: 'Centro',
        cidade: 'São João del Rei', uf: 'MG', principal: true },
    })
    exigir(r, [201], 'endereço do cliente')
    console.log('Endereço do cliente: criado (São João del Rei)')
  }

  // ---------- categorias ----------
  const lista = await pedir('GET', '/categorias?limite=100')
  exigir(lista, [200], 'listar categorias')
  const existentes = new Map(((lista.corpo.itens ?? []) as { id: number; slug: string }[]).map((c) => [c.slug, c.id]))
  for (const categoria of categorias) {
    if (existentes.has(categoria.slug)) continue
    const r = await pedir('POST', '/categorias', { sessao: admin, body: categoria })
    exigir(r, [201], `criar a categoria ${categoria.slug}`)
    existentes.set(categoria.slug, Number(r.corpo.id))
    console.log(`Categoria criada: ${categoria.nome}`)
  }

  // ---------- produtos com estoque ----------
  let criados = 0, jaExistiam = 0, entradas = 0
  for (const produto of produtos) {
    const busca = await pedir('GET', `/produtos?busca=${encodeURIComponent(produto.nome)}&limite=100`)
    exigir(busca, [200], `buscar o produto ${produto.nome}`)
    let id = ((busca.corpo.itens ?? []) as { id: number; nome: string }[]).find((p) => p.nome === produto.nome)?.id
    if (id) {
      jaExistiam++
    } else {
      const { categoria, estoque: _estoque, ...dados } = produto
      const r = await pedir('POST', '/produtos', { sessao: admin, body: { ...dados, categoriaId: existentes.get(categoria) } })
      exigir(r, [201], `criar o produto ${produto.nome}`)
      id = Number(r.corpo.id)
      criados++
    }
    // Estoque só se ainda está zerado (a mesma chave de idempotência por produto garante uma entrada só)
    const saldo = await pedir('GET', `/estoque/${id}`, { sessao: admin })
    exigir(saldo, [200], `saldo do produto ${produto.nome}`)
    if (saldo.corpo.saldoAtual === 0) {
      const r = await pedir('POST', '/estoque/movimentacoes', {
        sessao: admin,
        chave: chaveDaEntrada(id),
        body: { produtoId: id, tipo: 'entrada', quantidade: produto.estoque, motivo: 'Estoque inicial da demonstração' },
      })
      exigir(r, [200, 201], `entrada de estoque de ${produto.nome}`)
      entradas++
    }
  }
  console.log(`Produtos: ${criados} criados, ${jaExistiam} já existiam; ${entradas} entradas de estoque`)

  // ---------- sair das sessões ----------
  for (const sessao of [admin, cliente]) await pedir('POST', '/auth/logout', { sessao })
}

try {
  await principal()
} catch (err) {
  console.error(`Dados de demonstração: ${err instanceof Error ? err.message : 'erro inesperado'}`)
  process.exitCode = 1
}

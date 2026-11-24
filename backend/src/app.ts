import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import type { RequestHandler } from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import { routes } from './routes/index.js'


// O index.html do frontend tem um <script> inline (o tema claro/escuro, que precisa rodar antes da pintura). Em vez de
// liberar 'unsafe-inline' (que deixaria passar QUALQUER script injetado), a CSP libera só o hash SHA-256 exato de cada
// script inline do index.html deste build, calculado na subida. Mudou o script no frontend, o próximo build gera o hash
// novo sozinho. Sem FRONTEND_DIST (só a API), nenhum hash
function hashesDosScriptsInline(pasta: string | undefined): string[] {
  if (!pasta) return []
  const html = readFileSync(join(pasta, 'index.html'), 'utf8')
  const hashes: string[] = []
  for (const [, conteudo] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (conteudo.trim()) hashes.push(`'sha256-${createHash('sha256').update(conteudo, 'utf8').digest('base64')}'`)
  }
  return hashes
}

export const app = express()
// Produção atrás de UM proxy (o Caddy, docker-compose.prod.yml): o req.ip (rate limit) vem do X-Forwarded-For que ele
// escreve. Por isso nenhuma porta da app é publicada: só o Caddy fala com ela
if (env.nodeEnv === 'production') app.set('trust proxy', env.trustProxy)

// Cabeçalhos de segurança (Lote 13) em TODA resposta, da API e do site. A CSP libera só o necessário:
//   - img-src data: (o QR code do Pix vem como data:image) e https: (fotos de produto podem vir de outro site);
//   - style-src 'unsafe-inline' (estilos inline do React) e fonts.googleapis.com (o CSS do Google Fonts, no
//     index.html do frontend); font-src fonts.gstatic.com (as fontes que esse CSS carrega) e data:;
//   - script-src: 'self' e o hash de cada script inline do index.html (hashesDosScriptsInline, acima); nada de
//     'unsafe-inline', 'unsafe-eval' nem outra origem em script-src e connect-src: o site só fala com a própria API.
// HSTS só em produção (180 dias, sem preload e sem subdomínios: o domínio ainda nem foi comprado). O resto, o
// padrão do helmet (nosniff, X-Frame-Options, Cross-Origin-*-Policy, sem X-Powered-By...)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'", ...hashesDosScriptsInline(env.frontendDist)],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  strictTransportSecurity: env.nodeEnv === 'production'
    ? { maxAge: 180 * 24 * 60 * 60, includeSubDomains: false, preload: false }
    : false,
  // A recuperação recebe ?token= na URL. no-referrer impede que o navegador o copie para pedidos seguintes,
  // inclusive à própria API/assets. A proteção de CSRF continua conferindo Origin (exigirOrigem), não Referer.
  referrerPolicy: { policy: 'no-referrer' },
  xContentTypeOptions: true,
}))
// Uma origem: o mesmo comportamento de sempre (o header sai com ela). Várias: o cors devolve só a que bater
app.use(cors({ origin: env.corsOrigins.length === 1 ? env.corsOrigins[0] : env.corsOrigins, credentials: true }))
// Defesa mantida após a atualização do body-parser: JSON de até 100 KiB, sem descompressão.
// verify guarda o corpo cru: o HMAC do webhook é calculado sobre o corpo exatamente como chegou, e re-serializar
// o JSON mudaria os bytes. O req do verify é o Request do Express (o body-parser o tipa como IncomingMessage).
app.use(express.json({
  limit: '100kb',
  inflate: false,
  verify: (req, _res, buf) => {
    (req as express.Request).rawBody = buf
  },
}))
app.use(cookieParser())
app.use('/api', routes)

// /api e /api/... nunca chegam ao site: rota de API desconhecida continua 404 em JSON (o notFound), nunca o index.html
function ehApi(caminho: string): boolean {
  return caminho === '/api' || caminho.startsWith('/api/')
}

// Site no MESMO endereço da API (Lote 13), só com FRONTEND_DIST definida (env.ts confere que a pasta tem o
// index.html). Sem ela, nada muda: em desenvolvimento o site vem do Vite, com o proxy de /api.
if (env.frontendDist) {
  const pasta = env.frontendDist
  const pastaAssets = join(pasta, 'assets') + sep
  // index: false: o index.html só sai pelo fallback abaixo, sempre com no-cache. Os arquivos de /assets/ têm o hash
  // do conteúdo no nome (o Vite gera um nome novo a cada build), então podem ficar 1 ano em cache; o resto (favicon,
  // imagens da pasta public), no-cache. O express.static recusa ../ e arquivos fora da pasta, e ignora dotfiles.
  const estaticos = express.static(pasta, {
    index: false,
    setHeaders(res, caminho) {
      res.setHeader('Cache-Control', caminho.startsWith(pastaAssets) ? 'public, max-age=31536000, immutable' : 'no-cache')
    },
  })
  const site: RequestHandler = (req, res, next) => {
    if (ehApi(req.path)) {
      next()
      return
    }
    estaticos(req, res, next)
  }
  // O roteamento do React: GET/HEAD de qualquer caminho fora de /api que não é um arquivo recebe o index.html.
  // /assets/ que não existe é 404 (um .js velho de outro build não pode virar HTML)
  const fallbackDoReact: RequestHandler = (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || ehApi(req.path) || req.path.startsWith('/assets/')) {
      next()
      return
    }
    res.sendFile(join(pasta, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } })
  }
  app.use(site)
  app.use(fallbackDoReact)
}

app.use(notFound)
app.use(errorHandler)

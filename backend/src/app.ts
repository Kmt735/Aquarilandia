import { join, sep } from 'node:path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import type { RequestHandler } from 'express'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import { routes } from './routes/index.js'


export const app = express()
if (env.nodeEnv === 'production') app.set('trust proxy', 1)
app.use(cors({ origin: env.corsOrigin, credentials: true }))
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

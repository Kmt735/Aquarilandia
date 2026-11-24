// A API de desenvolvimento aceita http://localhost:5173. Unifica o endereço do
// documento antes de qualquer formulário, preservando a validação de Origin da API.
export function redirecionarOrigemLocal(req, res, next) {
  const host = req.headers.host
  const documento = (req.method === 'GET' || req.method === 'HEAD') && req.headers.accept?.includes('text/html')
  if (!documento || !['127.0.0.1:5173', '[::1]:5173'].includes(host)
    || !req.url?.startsWith('/') || /^\/api(?:\/|\?|$)/.test(req.url)) {
    next()
    return
  }
  res.writeHead(307, { Location: `http://localhost:5173${req.url}`, 'Cache-Control': 'no-store' })
  res.end()
}

export default function origemLocalCanonica() {
  return {
    name: 'aquarilandia-origem-local',
    apply: 'serve',
    configureServer(server) {
      // Servidores efêmeros dos testes usam sua própria origem, compartilhada com a API da fixture.
      if (server.config.server.port === 5173 && !server.config.server.https) server.middlewares.use(redirecionarOrigemLocal)
    },
  }
}

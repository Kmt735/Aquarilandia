// Chaves de ambiente do frontend (Vite). Lidas num lugar só e seguras fora do Vite (testes em Node).
//
// VITE_CATALOGO_MOCK=true troca a API do catálogo pelos dados de demonstração de src/mocks/catalogo-api.js.
// Desligado por padrão: ligue só no seu .env.local (veja .env.example e o README).
const env = typeof import.meta.env === 'object' && import.meta.env ? import.meta.env : {}

export const CATALOGO_MOCK = env.VITE_CATALOGO_MOCK === 'true'

// VITE_API_URL: endereço da API. Padrão /api (mesmo endereço do site: o proxy do Vite em desenvolvimento, o rewrite do
// vercel.json ou o próprio backend em produção). Pode ser absoluto (https://api.exemplo.com/api), mas aí o cookie de
// sessão passa a ser de outro site e o navegador pode bloqueá-lo: prefira o proxy (veja docs/deploy-render-vercel.md)
export const API_URL = (env.VITE_API_URL || '/api').replace(/\/+$/, '')

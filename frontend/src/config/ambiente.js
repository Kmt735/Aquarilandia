// Chaves de ambiente do frontend (Vite). Lidas num lugar só e seguras fora do Vite (testes em Node).
//
// VITE_CATALOGO_MOCK=true troca a API do catálogo pelos dados de demonstração de src/mocks/catalogo-api.js.
// Desligado por padrão: ligue só no seu .env.local (veja .env.example e o README).
const env = typeof import.meta.env === 'object' && import.meta.env ? import.meta.env : {}

export const CATALOGO_MOCK = env.VITE_CATALOGO_MOCK === 'true'

# Dados de exemplo (mocks)

**Nada aqui é dado real da loja.** Estes arquivos existem só para o protótipo funcionar sem o backend.

| Arquivo | Substitui | Ponto de integração |
| --- | --- | --- |
| `catalogo-api.js` | catálogo inteiro no formato da API (`/categorias`, `/produtos`, `/peixes`), só com `VITE_CATALOGO_MOCK=true` | `services/catalogo.js` (`criarCatalogo`) |
| `catalogo.js` | estoque em número (`GET /api/produtos`, `GET /api/peixes`) | `services/catalogo.js` |
| `conta.js` | cliente logado e endereços (rotas de auth/clientes) | `services/conta.js` |
| `pedidos.js` | minhas compras e status (rotas de vendas/pagamentos) | `services/pedidos.js` |
| `frete.js` | regra de frete (`POST /api/frete/calcular`) | `services/frete.js` |
| `avaliacoes.js` | avaliação do site guardada no localStorage (futuro `POST/GET /api/avaliacoes-site` ou Google Form) | `services/avaliacoes.js` |
| `avaliacoes-produto.js` | avaliações de produtos e peixes no localStorage (futuro `GET/POST /api/produtos/:id/avaliacoes`) | `services/avaliacoes-produto.js` |

Quando a API estiver pronta, troque o corpo das funções em `src/services/` pelas chamadas `fetch('/api/...')`
e apague este diretório. Os componentes não precisam mudar.

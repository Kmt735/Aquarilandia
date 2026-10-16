# Decisões do projeto — Aquarilândia

Registro das decisões técnicas, para ninguém precisar redescobrir o porquê.
Formato: contexto → decisão → consequências. A mais recente fica embaixo.

---

## 001 — Sessões de login guardadas no banco, com cookie httpOnly

- **Data:** 2026-10-15
- **Status:** aceita
- **Dono:** Celio (módulo `auth`)

### Contexto
O site precisa de login para clientes e admins (`POST /api/auth/login`, `GET /api/auth/sessao`).
As opções eram sessão guardada no servidor ou token JWT guardado no navegador.

### Decisão
- A sessão fica **no banco**, na tabela `sessoes` (`db/init/10_clientes.sql`).
- O navegador recebe um token aleatório no cookie **`sid`**, com **`httpOnly`**: o JavaScript da página não
  consegue ler o cookie, então um script injetado (XSS) não rouba a sessão.
- O banco guarda só o **hash SHA-256** do token (`sessoes.token_hash`), nunca o token. Se o banco vazar, os
  hashes não servem para entrar em nenhuma conta.
- Cada sessão tem validade (`sessoes.expira_em`). Sessões vencidas são apagadas por limpeza periódica
  (índice `idx_sessoes_expira_em`).

### Consequências
- **Logout de verdade:** `POST /api/auth/logout` apaga a linha e a sessão morre na hora. Também dá para derrubar
  todas as sessões de um cliente (troca de senha, conta bloqueada).
- **LGPD:** ao anonimizar um cliente, as sessões dele são excluídas junto com os endereços.
- Toda requisição autenticada faz uma consulta em `sessoes` pelo hash do token (coluna com UNIQUE, então é
  indexada).
- O frontend não guarda token em `localStorage` e precisa enviar as requisições com `credentials: 'include'`.
  O CORS precisa de `credentials: true` e de uma origem fixa (`CORS_ORIGIN`), não `*`.

### Pendente
- Flags complementares do cookie: `Secure` (em produção) e `SameSite`.
- Tempo de validade da sessão e se ela renova a cada uso.

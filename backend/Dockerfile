# syntax=docker/dockerfile:1
# Imagem de produção da Aquarilândia (Lote 13): o site (build do frontend) e a API num processo só, no mesmo endereço.
# Contexto do build: a RAIZ do repositório (o docker-compose.prod.yml faz isso), porque a etapa 1 precisa do frontend/.
# O .dockerignore da raiz deixa de fora .env*, node_modules, testes e relatórios.
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- 1. build do frontend (vite build → dist/) ----------
FROM ${NODE_IMAGE} AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Sem VITE_CATALOGO_MOCK: o catálogo vem da API (os dados de demonstração do frontend ficam desligados)
RUN npm run build

# ---------- 2. compila o backend (tsc → dist/) e os scripts de operação (criar-admin, dados-demo) ----------
FROM ${NODE_IMAGE} AS backend
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
RUN npm run build
# Os scripts também viram JavaScript (o tsx é dependência de desenvolvimento e não vai para a imagem final)
RUN npx tsc --ignoreConfig --types node --outDir dist-scripts --rootDir . --module nodenext --moduleResolution nodenext \
      --target es2022 --strict --esModuleInterop --skipLibCheck --resolveJsonModule \
      scripts/criar-admin.ts scripts/dados-demo.ts

# ---------- 3. só as dependências de produção ----------
FROM ${NODE_IMAGE} AS dependencias
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 4. imagem final: só o necessário, usuário sem root ----------
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=3333 \
    FRONTEND_DIST=/app/frontend-dist
WORKDIR /app/backend
# Os arquivos ficam do root e só para leitura do usuário node: o processo não consegue alterar o próprio código
COPY --from=dependencias /build/backend/node_modules ./node_modules
COPY --from=backend /build/backend/dist ./dist
COPY --from=backend /build/backend/dist-scripts ./dist-scripts
COPY backend/package.json ./
COPY --from=frontend /build/frontend/dist /app/frontend-dist
USER node
EXPOSE 3333
# O compose confere a saúde por aqui (sem curl na imagem: o próprio Node faz o pedido)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3333/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]

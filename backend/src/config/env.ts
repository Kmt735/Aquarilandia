export const env = {
  port: Number(process.env.PORT ?? 3333),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://aquarilandia:aquarilandia@localhost:5432/aquarilandia',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiUrl: process.env.API_URL,
  frontendUrl: process.env.FRONTEND_URL,
  gatewayAccessToken: process.env.GATEWAY_ACCESS_TOKEN,
  gatewayWebhookSecret: process.env.GATEWAY_WEBHOOK_SECRET,
  emailApiKey: process.env.EMAIL_API_KEY,
  emailRemetente: process.env.EMAIL_REMETENTE,
}
export const env = {
  port: Number(process.env.PORT ?? 3333),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://aquarilandia:aquarilandia@localhost:5432/aquarilandia',
}

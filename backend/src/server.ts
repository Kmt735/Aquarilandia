import { app } from './app.js'
import { env } from './config/env.js'

app.listen(env.port, () => {
  console.log(`🐟 API da Aquarilândia rodando em http://localhost:${env.port}/api`)
})

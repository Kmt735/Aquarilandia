import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import { routes } from './routes/index.js'

export const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())

app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

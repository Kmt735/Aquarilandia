import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import { routes } from './routes/index.js'
import { AppError } from './utils/AppError.js'
import cookieParser from 'cookie-parser'

export const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())
app.use(cookieParser())
app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)


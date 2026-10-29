import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'
import { routes } from './routes/index.js'


export const app = express()
if (env.nodeEnv === 'production') app.set('trust proxy', 1)
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)


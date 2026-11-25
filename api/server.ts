import express from 'express'
import cors from 'cors'
import { pool } from './db.js'
import { redis } from '../lib/redis.js'
import authRoutes from './routes/auth.js'
import clienteRoutes from './routes/clientes.js'
import historicoRoutes from './routes/historico.js'
import relatorioRoutes from './routes/relatorios.js'

// Usar variáveis de ambiente do Render / ambiente
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

const app = express()

// Middlewares
// Reflete a origem da requisição e permite credenciais (cookies/headers),
// necessário para o frontend no Vercel chamar a API com credentials: 'include'.
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)
app.use(express.json({ limit: '10kb' }))

// Routes
app.use('/auth', authRoutes)
app.use('/api/clientes', clienteRoutes)
app.use('/api/historico', historicoRoutes)
app.use('/api/relatorios', relatorioRoutes)

// Health check endpoint — o frontend exige { status, database, redis }
app.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'down'
  let redisStatus: 'up' | 'down' = 'down'

  try {
    await pool.query('SELECT 1')
    database = 'up'
  } catch (error) {
    console.error('Health: PostgreSQL indisponível:', (error as Error).message)
  }

  try {
    if (redis) {
      const pong = await redis.ping()
      redisStatus = pong === 'PONG' ? 'up' : 'down'
    }
  } catch (error) {
    console.error('Health: Redis indisponível:', (error as Error).message)
  }

  res.json({ status: 'ok', database, redis: redisStatus })
})

// Raiz
app.get('/', (_req, res) => {
  res.json({
    message: 'API Carteira de Clientes',
    version: '1.1.0',
    endpoints: {
      auth: '/auth',
      clientes: '/api/clientes',
      historico: '/api/historico',
      relatorios: '/api/relatorios',
      health: '/health',
    },
  })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Rota não encontrada', code: 'NOT_FOUND' } })
})

// @ts-expect-error: handler assinado com tipos simplificados (err, res) - Express aceita via compatibilidade
app.use((err: Error, res) => {
  console.error('Erro não tratado:', err.message)
  res.status(500).json({ error: { message: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } })
})

// Iniciar servidor
async function iniciar() {
  // Testar conexão com o banco de dados ao iniciar
  try {
    const client = await pool.connect()
    console.log('✅ Conexão com PostgreSQL estabelecida com sucesso')
    client.release()
  } catch (err) {
    console.error('❌ Erro ao conectar no PostgreSQL:', (err as Error).message)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`🚀 Servidor API rodando na porta ${PORT}`)
    console.log(`📊 Health check: http://localhost:${PORT}/health`)
  })
}

void iniciar()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 recebido sinal SIGTERM. Encerrando...')
  await pool.end()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 recebido sinal SIGINT. Encerrando...')
  await pool.end()
  process.exit(0)
})

import express from 'express'
import cors from 'cors'
import { pool } from './db.js'
import clienteRoutes from './routes/clientes.js'
import historicoRoutes from './routes/historico.js'
import relatorioRoutes from './routes/relatorios.js'

// Usar variáveis de ambiente do Render / ambiente
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

// Testar conexão com o banco de dados ao iniciar
pool.connect()
  .then((client) => {
    console.log('✅ Conexão com PostgreSQL estabelecida com sucesso')
    client.release()
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar no PostgreSQL:', err.message)
    process.exit(1)
  })

const app = express()

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10kb' }))

// Routes
app.use('/api/clientes', clienteRoutes)
app.use('/api/historico', historicoRoutes)
app.use('/api/relatorios', relatorioRoutes)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Raiz
app.get('/', (_req, res) => {
  res.json({
    message: 'API Carteira de Clientes',
    version: '1.0.0',
    endpoints: {
      clientes: '/api/clientes',
      historico: '/api/historico',
      relatorios: '/api/relatorios',
      health: '/health'
    }
  })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

// @ts-expect-error: handler assinado com tipos simplificados (err, res) - Express aceita via compatibilidade
app.use((err: Error, res) => {
  console.error('Erro não tratado:', err.message)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor API rodando na porta ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})

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
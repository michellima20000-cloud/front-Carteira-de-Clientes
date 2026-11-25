import { Router } from 'express'
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret-change-me'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me'
const ACCESS_TTL_SECONDS = 15 * 60 // 15 minutos
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 dias
const BCRYPT_ROUNDS = 10

interface UsuarioRow {
  id: string
  nome: string
  email: string
  senha_hash: string
  papel: string
  conta_id: string | null
  conta_nome: string | null
  conta_plano: string | null
  conta_timezone: string | null
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function signAccessToken(payload: { sub: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS })
}

function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SECONDS })
}

async function storeRefreshToken(usuarioId: string, refreshToken: string): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)
  await pool.query(
    'INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [usuarioId, sha256(refreshToken), expiresAt],
  )
}

async function loadUsuario(usuarioId: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query<UsuarioRow>(
    `SELECT u.id, u.nome, u.email, u.senha_hash, u.papel, u.conta_id,
            c.nome AS conta_nome, c.plano AS conta_plano, c.timezone AS conta_timezone
       FROM usuarios u
       LEFT JOIN contas c ON c.id = u.conta_id
      WHERE u.id = $1`,
    [usuarioId],
  )
  return rows[0] ?? null
}

function toAuthData(usuario: UsuarioRow) {
  const accessToken = signAccessToken({ sub: usuario.id, email: usuario.email })
  const refreshToken = signRefreshToken({ sub: usuario.id })

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
    user: {
      id: usuario.id,
      name: usuario.nome,
      email: usuario.email,
      role: usuario.papel,
      account: usuario.conta_id
        ? {
            id: usuario.conta_id,
            name: usuario.conta_nome ?? '',
            plan: usuario.conta_plano ?? 'free',
            timezone: usuario.conta_timezone ?? 'America/Sao_Paulo',
          }
        : null,
    },
    account: usuario.conta_id
      ? {
          id: usuario.conta_id,
          name: usuario.conta_nome ?? '',
          plan: usuario.conta_plano ?? 'free',
          timezone: usuario.conta_timezone ?? 'America/Sao_Paulo',
        }
      : null,
  }
}

export default Router()
  // POST /auth/signup - criar conta de acesso
  .post('/signup', async (req: Request, res: Response) => {
    try {
      const { nome, email, senha } = req.body as {
        nome?: string
        email?: string
        senha?: string
      }

      if (!nome?.trim() || !email?.trim() || !senha) {
        return res.status(400).json({
          error: { message: 'Nome, e-mail e senha são obrigatórios.', code: 'VALIDATION_ERROR' },
        })
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          error: { message: 'Informe um e-mail válido.', code: 'VALIDATION_ERROR' },
        })
      }

      if (senha.length < 8) {
        return res.status(400).json({
          error: {
            message: 'A senha deve ter pelo menos 8 caracteres.',
            code: 'VALIDATION_ERROR',
          },
        })
      }

      const emailNormalizado = email.trim().toLowerCase()

      const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [
        emailNormalizado,
      ])
      if (existente.rows.length > 0) {
        return res.status(409).json({
          error: { message: 'Já existe uma conta com este e-mail.', code: 'EMAIL_IN_USE' },
        })
      }

      const senhaHash = await bcrypt.hash(senha, BCRYPT_ROUNDS)

      // Cria a conta (organização) e o usuário responsável em uma transação
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const conta = await client.query<{ id: string }>(
          'INSERT INTO contas (nome) VALUES ($1) RETURNING id',
          [`Conta de ${nome.trim()}`],
        )
        const usuario = await client.query<{ id: string; nome: string; email: string; papel: string; conta_id: string }>(
          `INSERT INTO usuarios (nome, email, senha_hash, papel, conta_id)
           VALUES ($1, $2, $3, 'owner', $4)
           RETURNING id, nome, email, papel, conta_id`,
          [nome.trim(), emailNormalizado, senhaHash, conta.rows[0].id],
        )
        await client.query('COMMIT')

        const completo = await loadUsuario(usuario.rows[0].id)
        if (!completo) {
          return res.status(500).json({
            error: { message: 'Erro ao carregar conta criada.', code: 'INTERNAL_ERROR' },
          })
        }

        const authData = toAuthData(completo)
        await storeRefreshToken(completo.id, authData.refreshToken)
        return res.status(201).json(authData)
      } catch (erro) {
        await client.query('ROLLBACK')
        throw erro
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('Erro no signup:', error)
      return res.status(500).json({
        error: { message: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' },
      })
    }
  })

  // POST /auth/login - autenticar
  .post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string }

      if (!email?.trim() || !password) {
        return res.status(400).json({
          error: { message: 'Informe e-mail e senha.', code: 'VALIDATION_ERROR' },
        })
      }

      const { rows } = await pool.query<UsuarioRow>(
        `SELECT u.id, u.nome, u.email, u.senha_hash, u.papel, u.conta_id,
                c.nome AS conta_nome, c.plano AS conta_plano, c.timezone AS conta_timezone
           FROM usuarios u
           LEFT JOIN contas c ON c.id = u.conta_id
          WHERE u.email = $1`,
        [email.trim().toLowerCase()],
      )

      const usuario = rows[0]
      if (!usuario) {
        return res.status(401).json({
          error: { message: 'E-mail ou senha incorretos.', code: 'INVALID_CREDENTIALS' },
        })
      }

      const senhaValida = await bcrypt.compare(password, usuario.senha_hash)
      if (!senhaValida) {
        return res.status(401).json({
          error: { message: 'E-mail ou senha incorretos.', code: 'INVALID_CREDENTIALS' },
        })
      }

      const authData = toAuthData(usuario)
      await storeRefreshToken(usuario.id, authData.refreshToken)
      return res.json(authData)
    } catch (error) {
      console.error('Erro no login:', error)
      return res.status(500).json({
        error: { message: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' },
      })
    }
  })

  // POST /auth/refresh - renovar tokens
  .post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string }

      if (!refreshToken) {
        return res.status(400).json({
          error: { message: 'refreshToken é obrigatório.', code: 'VALIDATION_ERROR' },
        })
      }

      let payload: { sub?: string }
      try {
        payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { sub?: string }
      } catch {
        return res.status(401).json({
          error: { message: 'Sessão expirada. Entre novamente.', code: 'INVALID_REFRESH' },
        })
      }

      if (!payload.sub) {
        return res.status(401).json({
          error: { message: 'Sessão inválida.', code: 'INVALID_REFRESH' },
        })
      }

      // Token precisa existir no banco (não revogado) e estar válido
      const { rows } = await pool.query(
        'SELECT id FROM refresh_tokens WHERE usuario_id = $1 AND token_hash = $2 AND expires_at > NOW()',
        [payload.sub, sha256(refreshToken)],
      )
      if (rows.length === 0) {
        return res.status(401).json({
          error: { message: 'Sessão expirada. Entre novamente.', code: 'INVALID_REFRESH' },
        })
      }

      const usuario = await loadUsuario(payload.sub)
      if (!usuario) {
        return res.status(401).json({
          error: { message: 'Usuário não encontrado.', code: 'INVALID_REFRESH' },
        })
      }

      // Rotação: invalida o antigo e emite novos
      await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id])

      const authData = toAuthData(usuario)
      await storeRefreshToken(usuario.id, authData.refreshToken)
      return res.json(authData)
    } catch (error) {
      console.error('Erro no refresh:', error)
      return res.status(500).json({
        error: { message: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' },
      })
    }
  })

  // GET /auth/me - dados do usuário autenticado
  .get('/me', async (req: Request, res: Response) => {
    try {
      const header = req.headers.authorization ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : ''

      if (!token) {
        return res.status(401).json({
          error: { message: 'Não autenticado.', code: 'UNAUTHENTICATED' },
        })
      }

      let payload: { sub?: string }
      try {
        payload = jwt.verify(token, JWT_SECRET) as { sub?: string }
      } catch {
        return res.status(401).json({
          error: { message: 'Sua sessão expirou. Entre novamente.', code: 'TOKEN_EXPIRED' },
        })
      }

      if (!payload.sub) {
        return res.status(401).json({
          error: { message: 'Sessão inválida.', code: 'UNAUTHENTICATED' },
        })
      }

      const usuario = await loadUsuario(payload.sub)
      if (!usuario) {
        return res.status(401).json({
          error: { message: 'Usuário não encontrado.', code: 'UNAUTHENTICATED' },
        })
      }

      return res.json({
        id: usuario.id,
        name: usuario.nome,
        email: usuario.email,
        role: usuario.papel,
        account: usuario.conta_id
          ? {
              id: usuario.conta_id,
              name: usuario.conta_nome ?? '',
              plan: usuario.conta_plano ?? 'free',
              timezone: usuario.conta_timezone ?? 'America/Sao_Paulo',
            }
          : null,
      })
    } catch (error) {
      console.error('Erro em /auth/me:', error)
      return res.status(500).json({
        error: { message: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' },
      })
    }
  })

  // POST /auth/logout - encerrar sessão (revoga refresh token)
  .post('/logout', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string }

      if (refreshToken) {
        await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [
          sha256(refreshToken),
        ])
      }

      return res.status(204).send()
    } catch (error) {
      console.error('Erro no logout:', error)
      return res.status(500).json({
        error: { message: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' },
      })
    }
  })

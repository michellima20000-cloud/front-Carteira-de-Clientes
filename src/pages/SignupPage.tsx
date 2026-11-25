import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { ApiError } from '../api/http'

export default function SignupPage() {
  const [accountName, setAccountName] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErro(null)
    setSucesso(null)
    setEnviando(true)

    try {
      await authApi.signup({
        accountName: accountName.trim(),
        name: nome.trim(),
        email: email.trim(),
        password: senha,
      })

      setSucesso('Conta criada com sucesso! Redirecionando para o login...')
      setAccountName('')
      setNome('')
      setEmail('')
      setSenha('')
      setTimeout(() => navigate('/entrar'), 1500)
    } catch (err) {
      if (err instanceof ApiError) {
        setErro(err.message)
      } else {
        setErro(
          err instanceof Error
            ? err.message
            : 'Não foi possível conectar ao servidor. Verifique sua conexão.',
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-labelledby="story-title">
        <h1 id="story-title">Criar Conta</h1>
        <p>Organize seus clientes em um só lugar.</p>
      </section>

      <section className="auth-panel">
        <div className="login-card">
          <div className="login-card__heading">
            <p className="eyebrow">Comece agora</p>
            <h2>Criar sua conta</h2>
            <p>Preencha os dados abaixo para criar seu acesso.</p>
          </div>

          {erro && (
            <div className="error-notice error-notice--simple" role="alert">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="success-notice" role="status">
              {sucesso}
            </div>
          )}

          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="signup-account">Nome da empresa / conta</label>
              <div className="input-wrap">
                <input
                  id="signup-account"
                  name="accountName"
                  type="text"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  autoComplete="organization"
                  placeholder="Ex: Minha Empresa"
                  minLength={2}
                  maxLength={100}
                  disabled={enviando}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="signup-nome">Nome completo</label>
              <div className="input-wrap">
                <input
                  id="signup-nome"
                  name="name"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  autoComplete="name"
                  placeholder="Seu nome"
                  minLength={2}
                  maxLength={100}
                  disabled={enviando}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="signup-email">E-mail</label>
              <div className="input-wrap">
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="voce@empresa.com.br"
                  disabled={enviando}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="signup-senha">Senha</label>
              <div className="input-wrap">
                <input
                  id="signup-senha"
                  name="senha"
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  minLength={8}
                  maxLength={128}
                  disabled={enviando}
                  required
                />
              </div>
            </div>

            <button
              className="button button--primary button--full"
              type="submit"
              disabled={enviando}
            >
              {enviando ? 'Criando conta...' : 'Criar minha conta'}
            </button>
          </form>

          <p className="login-card__help">
            Já tem conta? <Link to="/entrar">Entrar</Link>
          </p>
        </div>
      </section>
    </main>
  )
}

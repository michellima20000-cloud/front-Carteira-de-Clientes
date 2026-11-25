import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { ErrorNotice } from '../components/ErrorNotice';

interface FieldErrors {
  email?: string;
  password?: string;
}

type ServiceState = 'checking' | 'online' | 'offline';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceState, setServiceState] = useState<ServiceState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    authApi
      .health(controller.signal)
      .then((health) => {
        if (!controller.signal.aborted) {
          setServiceState(
            health.status === 'ok' && health.database === 'up' && health.redis === 'up'
              ? 'online'
              : 'offline',
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setServiceState('offline');
        }
      });

    return () => controller.abort();
  }, []);

  function validate(): boolean {
    const nextErrors: FieldErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Informe um e-mail válido.';
    }

    if (!password) {
      nextErrors.password = 'Informe sua senha.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      void navigate('/conta', { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-labelledby="story-title">
        <Brand inverse />

        <div className="auth-story__content">
          <p className="eyebrow eyebrow--light">Relacionamentos com contexto</p>
          <h1 id="story-title">Sua carteira, organizada em um só lugar.</h1>
          <p>
            Um espaço simples e seguro para cuidar dos seus clientes e manter cada conversa
            relevante por perto.
          </p>

          <ul className="feature-list" aria-label="Benefícios">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <strong>Acesso protegido</strong>
                <p>Sessões renovadas sem guardar credenciais no navegador.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <strong>Organização por conta</strong>
                <p>Comece sempre pela empresa correta.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <strong>Experiência leve</strong>
                <p>Interface rápida, responsiva e fácil de usar.</p>
              </div>
            </li>
          </ul>
        </div>

        <p className="auth-story__footer">Carteira de Clientes · Fase 1</p>
      </section>

      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-panel__mobile-brand">
          <Brand />
        </div>

        <div className="login-card">
          <div className="login-card__heading">
            <span className={`service-indicator service-indicator--${serviceState}`}>
              <span aria-hidden="true" />
              {serviceState === 'checking'
                ? 'Verificando serviço'
                : serviceState === 'online'
                  ? 'Sistema operacional'
                  : 'Serviço temporariamente indisponível'}
            </span>
            <p className="eyebrow">Bem-vindo de volta</p>
            <h2 id="login-title">Entre na sua conta</h2>
            <p>Use suas credenciais para acessar o painel.</p>
          </div>

          {formError && <ErrorNotice title="Falha no acesso" message={formError} />}

          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="email">E-mail</label>
              <div className={`input-wrap ${fieldErrors.email ? 'input-wrap--error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6.5h16v11H4z" />
                  <path d="m5 7.5 7 6 7-6" />
                </svg>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((current) => ({ ...current, email: undefined }));
                    }
                  }}
                  autoComplete="email"
                  placeholder="voce@empresa.com.br"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {fieldErrors.email && (
                <span className="field-error" id="email-error">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="password">Senha</label>
              <div className={`input-wrap ${fieldErrors.password ? 'input-wrap--error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((current) => ({ ...current, password: undefined }));
                    }
                  }}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  disabled={isSubmitting}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={isSubmitting}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {fieldErrors.password && (
                <span className="field-error" id="password-error">
                  {fieldErrors.password}
                </span>
              )}
            </div>

            <button
              className="button button--primary button--full"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner spinner--small" aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                'Entrar na minha conta'
              )}
            </button>
          </form>

          <p className="login-card__help">
            Ainda não tem conta?{' '}
            <Link to="/signup" className="login-card__signup-link">
              Criar conta
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

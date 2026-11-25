import { apiRequest } from './http';

export interface Account {
  id: string;
  name: string;
  plan: string;
  timezone: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  account: Account | null;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
  account: Account | null;
  accounts?: Account[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  nome: string;
  email: string;
  senha: string;
}

export interface HealthStatus {
  status: 'ok';
  database: 'up' | 'down';
  redis: 'up' | 'down';
}

/**
 * Único ponto que envia o refresh token no corpo da requisição.
 *
 * Quando a API oferecer um cookie HttpOnly, altere esta função para fazer
 * POST /auth/refresh sem body. O restante do aplicativo já usa
 * `credentials: 'include'` e não precisa conhecer a estratégia de transporte.
 */
async function requestTokenRefresh(refreshToken: string, signal?: AbortSignal): Promise<AuthData> {
  return apiRequest<AuthData>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
    retryOnUnauthorized: false,
    signal,
  });
}

export const authApi = {
  signup(credentials: SignupCredentials, signal?: AbortSignal): Promise<AuthData> {
    return apiRequest<AuthData>('/auth/signup', {
      method: 'POST',
      body: credentials,
      auth: false,
      retryOnUnauthorized: false,
      signal,
    });
  },

  login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthData> {
    return apiRequest<AuthData>('/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
      retryOnUnauthorized: false,
      signal,
    });
  },

  refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthData> {
    return requestTokenRefresh(refreshToken, signal);
  },

  me(signal?: AbortSignal): Promise<AuthUser> {
    return apiRequest<AuthUser>('/auth/me', {
      method: 'GET',
      signal,
    });
  },

  logout(refreshToken: string, signal?: AbortSignal): Promise<void> {
    return apiRequest<void>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      signal,
    });
  },

  health(signal?: AbortSignal): Promise<HealthStatus> {
    return apiRequest<HealthStatus>('/health', {
      method: 'GET',
      auth: false,
      retryOnUnauthorized: false,
      signal,
    });
  },
};

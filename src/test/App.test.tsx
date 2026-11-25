import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { authApi, type AuthData, type AuthUser } from '../api/authApi';
import { ApiError } from '../api/http';
import { tokenStore } from '../api/tokenStore';

vi.mock('../api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    health: vi.fn(),
  },
}));

const account = {
  id: 'account-001',
  name: 'Studio Aurora',
  plan: 'Professional',
  timezone: 'America/Sao_Paulo',
};

const user: AuthUser = {
  id: 'user-001',
  name: 'Marina Souza',
  email: 'marina@example.com',
  role: 'admin',
  account,
};

const authData: AuthData = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
  user,
  account,
};

async function fillAndSubmitLogin() {
  const userEventInstance = userEvent.setup();

  await userEventInstance.type(screen.getByLabelText('E-mail'), 'marina@example.com');
  await userEventInstance.type(screen.getByLabelText('Senha'), 'senha-secreta');
  await userEventInstance.click(screen.getByRole('button', { name: 'Entrar na minha conta' }));
}

describe('autenticação e proteção de rotas', () => {
  beforeEach(() => {
    tokenStore.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');

    vi.mocked(authApi.login).mockResolvedValue(authData);
    vi.mocked(authApi.refresh).mockResolvedValue(authData);
    vi.mocked(authApi.me).mockResolvedValue(user);
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    vi.mocked(authApi.health).mockResolvedValue({
      status: 'ok',
      database: 'up',
      redis: 'up',
    });
  });

  it('mantém o sistema disponível quando a API está degradada, mas o banco responde', async () => {
    vi.mocked(authApi.health).mockResolvedValue({
      status: 'degraded',
      database: 'up',
      redis: 'down',
    });

    render(<App />);

    expect(await screen.findByText('Sistema disponível com restrições')).toBeInTheDocument();
    expect(screen.queryByText('Serviço temporariamente indisponível')).not.toBeInTheDocument();
  });

  it('realiza login, confirma a conta e abre o painel protegido', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeInTheDocument();

    await fillAndSubmitLogin();

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'marina@example.com',
        password: 'senha-secreta',
      });
      expect(authApi.me).toHaveBeenCalledOnce();
    });

    expect(await screen.findByRole('heading', { name: 'Escolha sua conta' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Studio Aurora/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirmar conta e continuar/ }));

    expect(await screen.findByRole('heading', { name: 'Olá, Marina.' })).toBeInTheDocument();
    expect(screen.getByText('Sessão ativa')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app');
  });

  it('redireciona uma rota protegida para o login quando não há sessão', async () => {
    window.history.replaceState({}, '', '/app');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Olá, Marina.' })).not.toBeInTheDocument();
  });

  it('exibe uma mensagem compreensível quando as credenciais são rejeitadas', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError('E-mail ou senha incorretos.', 401, 'INVALID_CREDENTIALS'),
    );

    render(<App />);
    await screen.findByRole('heading', { name: 'Entre na sua conta' });
    await fillAndSubmitLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getByRole('button', { name: 'Entrar na minha conta' })).toBeEnabled();
  });

  it('renova uma sessão salva somente no sessionStorage', async () => {
    window.sessionStorage.setItem('carteira-clientes.refresh-token', 'refresh-token');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Escolha sua conta' })).toBeInTheDocument();
    expect(authApi.refresh).toHaveBeenCalledWith('refresh-token');
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('encerra a sessão e remove os tokens locais', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Entre na sua conta' });
    await fillAndSubmitLogin();
    await screen.findByRole('heading', { name: 'Escolha sua conta' });

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entre na sua conta' })).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledWith('refresh-token');
    expect(window.sessionStorage.getItem('carteira-clientes.refresh-token')).toBeNull();
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('apresenta estado vazio quando a autenticação não possui conta vinculada', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      ...authData,
      user: { ...user, account: null },
      account: null,
    });
    vi.mocked(authApi.me).mockResolvedValue({ ...user, account: null });

    render(<App />);
    await screen.findByRole('heading', { name: 'Entre na sua conta' });
    await fillAndSubmitLogin();

    expect(
      await screen.findByRole('heading', { name: 'Nenhuma conta disponível' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar sessão' })).toBeInTheDocument();
  });
});

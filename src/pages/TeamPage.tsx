import { useCallback, useEffect, useState } from 'react';
import { accountsApi, type TeamUser } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../auth/AuthContext';
import { Badge, EmptyState, Feedback, PageHeader, Panel } from '../components/ui';
import { formatDate } from '../utils/format';

function roleLabel(role: TeamUser['role']): string {
  if (role === 'OWNER') return 'Proprietário';
  if (role === 'ADMIN') return 'Administrador';
  return 'Atendente';
}

export function TeamPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await accountsApi.users());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações"
        title="Equipe"
        description="Usuários com acesso à carteira desta conta."
      />

      {error && <Feedback tone="error">{error}</Feedback>}

      <Panel
        title="Membros da equipe"
        description={`${users.length} usuário(s) · conta ${session?.account?.name ?? '—'}`}
      >
        {loading ? (
          <p className="table-loading">Carregando equipe...</p>
        ) : users.length === 0 ? (
          <EmptyState
            title="Nenhum usuário encontrado"
            description="Os usuários da conta aparecem aqui."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <Badge tone={user.role === 'AGENT' ? 'neutral' : 'info'}>
                        {roleLabel(user.role)}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={user.active ? 'success' : 'warning'}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Sobre esta conta">
        <dl className="detail-list">
          <div>
            <dt>Conta</dt>
            <dd>{session?.account?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Plano</dt>
            <dd>{session?.account?.plan ?? '—'}</dd>
          </div>
          <div>
            <dt>Fuso horário</dt>
            <dd>{session?.account?.timezone ?? '—'}</dd>
          </div>
          <div>
            <dt>Seu perfil</dt>
            <dd>{session?.user?.role ?? '—'}</dd>
          </div>
          <div>
            <dt>Conta criada em</dt>
            <dd>{formatDate(session?.user ? new Date().toISOString() : null)}</dd>
          </div>
        </dl>
      </Panel>
    </AppShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { goalsApi, type GoalDashboard } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, Feedback, Panel } from '../components/ui';
import { formatCurrency } from '../utils/format';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function DashboardPage() {
  const { session } = useAuth();
  const user = session?.user;
  const account = session?.account;
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await goalsApi.dashboard(currentMonth()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const goal = dashboard?.goal ?? null;
  const summary = dashboard?.summary;
  const topCustomers = (dashboard?.customers ?? []).slice(0, 5);

  return (
    <AppShell>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>Olá, {firstName(user?.name ?? 'usuário')}.</h1>
          <p>Resumo do desempenho da sua carteira neste mês.</p>
        </div>
        <span className="status-pill">
          <span aria-hidden="true" />
          Sessão ativa
        </span>
      </header>

      {error && <Feedback tone="error">{error}</Feedback>}

      <section className="dashboard-grid" aria-label="Resumo do mês">
        <article className="summary-card summary-card--accent">
          <span className="summary-card__label">Conta atual</span>
          <strong className="summary-card__value">{account?.name ?? 'Não selecionada'}</strong>
          <span className="summary-card__meta">Plano {account?.plan ?? '—'}</span>
          <span className="summary-card__illustration" aria-hidden="true">
            <svg viewBox="0 0 120 100">
              <path d="M18 28 88 10l14 52-70 20z" />
              <path d="m18 28 14 54 28-14 42-6" />
              <circle cx="57" cy="47" r="8" />
            </svg>
          </span>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Faturamento do mês</span>
          <strong className="summary-card__value">
            {formatCurrency(summary?.totalRealizedAmount ?? 0)}
          </strong>
          <span className="summary-card__meta">
            {summary?.totalSalesCount ?? 0} venda(s) registrada(s)
          </span>
        </article>

        <article className="summary-card">
          <span className="summary-card__label">Meta do mês</span>
          <strong className="summary-card__value">{formatCurrency(goal?.totalAmount ?? 0)}</strong>
          <span className="summary-card__meta">
            {goal ? `${goal.completionPercentage.toFixed(1)}% concluído` : 'Nenhuma meta definida'}
          </span>
        </article>
      </section>

      <Panel
        title="Clientes com meta"
        description={
          summary
            ? `${summary.customersHitGoalCount} de ${summary.customersWithGoalCount} cliente(s) atingiram a meta`
            : 'Defina uma meta no módulo Metas para acompanhar o progresso.'
        }
        actions={
          <a className="button button--secondary button--small" href="/metas">
            Ver metas
          </a>
        }
      >
        {loading ? (
          <p className="table-loading">Carregando resumo...</p>
        ) : topCustomers.length === 0 ? (
          <EmptyState
            title="Sem metas distribuídas"
            description="Crie uma meta mensal para dividir o objetivo entre os clientes da carteira."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Meta</th>
                  <th>Realizado</th>
                  <th>Progresso</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((item) => (
                  <tr key={item.customerId}>
                    <td>
                      <strong>{item.customer.name}</strong>
                    </td>
                    <td>{formatCurrency(item.targetAmount)}</td>
                    <td>{formatCurrency(item.realizedAmount)}</td>
                    <td>{item.completionPercentage.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

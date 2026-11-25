import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { goalsApi, type GoalDashboard, type GoalDistributionMode } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, Feedback, Modal, PageHeader, Panel } from '../components/ui';
import { formatCurrency } from '../utils/format';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function GoalsPage() {
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    month: currentMonth(),
    totalAmount: '',
    distributionMode: 'EQUAL' as GoalDistributionMode,
    historicalMonths: '3',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await goalsApi.dashboard(month));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as metas.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm({
      month,
      totalAmount: dashboard?.goal ? String(dashboard.goal.totalAmount) : '',
      distributionMode: dashboard?.goal?.distributionMode ?? 'EQUAL',
      historicalMonths: '3',
    });
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await goalsApi.upsert({
        month: form.month,
        totalAmount: Number(form.totalAmount),
        distributionMode: form.distributionMode,
        historicalMonths: Number(form.historicalMonths),
      });
      setNotice('Meta salva com sucesso.');
      setModalOpen(false);
      setMonth(form.month);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a meta.');
    } finally {
      setSaving(false);
    }
  }

  const goal = dashboard?.goal ?? null;
  const summary = dashboard?.summary;
  const customers = dashboard?.customers ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Carteira"
        title="Metas"
        description="Defina a meta do mês e acompanhe o progresso de cada cliente."
        actions={
          <div className="page-heading__actions">
            <input
              className="filter-bar__input"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              aria-label="Mês da meta"
            />
            <button className="button button--primary" type="button" onClick={openCreate}>
              {goal ? 'Ajustar meta' : 'Definir meta'}
            </button>
          </div>
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      {loading ? (
        <Panel title="Meta do mês">
          <p className="table-loading">Carregando metas...</p>
        </Panel>
      ) : (
        <>
          <section className="dashboard-grid" aria-label="Resumo da meta">
            <article className="summary-card summary-card--accent">
              <span className="summary-card__label">Meta do mês</span>
              <strong className="summary-card__value">
                {formatCurrency(goal?.totalAmount ?? 0)}
              </strong>
              <span className="summary-card__meta">
                {goal
                  ? `${goal.completionPercentage.toFixed(1)}% concluído`
                  : 'Nenhuma meta definida'}
              </span>
            </article>

            <article className="summary-card">
              <span className="summary-card__label">Realizado</span>
              <strong className="summary-card__value">
                {formatCurrency(summary?.totalRealizedAmount ?? 0)}
              </strong>
              <span className="summary-card__meta">
                {summary?.totalSalesCount ?? 0} venda(s) no período
              </span>
            </article>

            <article className="summary-card">
              <span className="summary-card__label">Falta</span>
              <strong className="summary-card__value">
                {formatCurrency(goal?.remainingAmount ?? 0)}
              </strong>
              <span className="summary-card__meta">
                {summary?.customersHitGoalCount ?? 0} de {summary?.customersWithGoalCount ?? 0}{' '}
                cliente(s) bateram a meta
              </span>
            </article>
          </section>

          <Panel
            title="Progresso por cliente"
            description={
              goal
                ? `Distribuição ${goal.distributionMode === 'EQUAL' ? 'equilibrada' : 'histórica'}`
                : 'Defina uma meta para distribuir o valor entre os clientes.'
            }
          >
            {customers.length === 0 ? (
              <EmptyState
                title="Nenhum cliente com meta"
                description="Defina a meta do mês para distribuir o valor entre os clientes."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Meta</th>
                      <th>Realizado</th>
                      <th>Falta</th>
                      <th>Progresso</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((item) => (
                      <tr key={item.customerId}>
                        <td>
                          <strong>{item.customer.name}</strong>
                          <span className="table-cell__meta">{item.customer.phone}</span>
                        </td>
                        <td>{formatCurrency(item.targetAmount)}</td>
                        <td>{formatCurrency(item.realizedAmount)}</td>
                        <td>{formatCurrency(item.remainingAmount)}</td>
                        <td>
                          <div className="progress">
                            <div
                              className="progress__bar"
                              style={{ width: `${Math.min(100, item.completionPercentage)}%` }}
                              role="progressbar"
                              aria-valuenow={item.completionPercentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                            <span className="progress__label">
                              {item.completionPercentage.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={item.hitGoal ? 'success' : 'warning'}>
                            {item.hitGoal ? 'Atingiu' : 'Em andamento'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {modalOpen && (
        <Modal title="Definir meta do mês" onClose={() => setModalOpen(false)}>
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="field-group">
                <label htmlFor="goal-month">Mês</label>
                <div className="input-wrap">
                  <input
                    id="goal-month"
                    type="month"
                    value={form.month}
                    onChange={(event) => setForm({ ...form, month: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="goal-total">Valor total (R$)</label>
                <div className="input-wrap">
                  <input
                    id="goal-total"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.totalAmount}
                    onChange={(event) => setForm({ ...form, totalAmount: event.target.value })}
                    placeholder="10000,00"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="goal-mode">Distribuição</label>
              <div className="input-wrap">
                <select
                  id="goal-mode"
                  value={form.distributionMode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      distributionMode: event.target.value as GoalDistributionMode,
                    })
                  }
                >
                  <option value="EQUAL">Equilibrada entre os clientes</option>
                  <option value="HISTORICAL">Baseada no histórico de compras</option>
                </select>
              </div>
            </div>

            {form.distributionMode === 'HISTORICAL' && (
              <div className="field-group">
                <label htmlFor="goal-months">Meses de histórico</label>
                <div className="input-wrap">
                  <input
                    id="goal-months"
                    type="number"
                    min="1"
                    max="24"
                    value={form.historicalMonths}
                    onChange={(event) => setForm({ ...form, historicalMonths: event.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="modal__footer">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar meta'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

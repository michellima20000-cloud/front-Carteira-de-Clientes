import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  customersApi,
  goalsApi,
  type Customer,
  type GoalDashboard,
  type GoalDistributionMode,
} from '../api/resources';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, Feedback, Modal, PageHeader, Panel } from '../components/ui';
import { formatCurrency } from '../utils/format';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface GoalFormState {
  month: string;
  totalAmount: string;
  distributionMode: GoalDistributionMode;
  historicalMonths: string;
  customerIds: string[];
}

const emptyGoalForm: GoalFormState = {
  month: currentMonth(),
  totalAmount: '',
  distributionMode: 'EQUAL',
  historicalMonths: '3',
  customerIds: [],
};

export function GoalsPage() {
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [activeCustomers, setActiveCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GoalFormState>(emptyGoalForm);
  const [customerSearch, setCustomerSearch] = useState('');

  const [adjusting, setAdjusting] = useState<{
    customerId: string;
    name: string;
    amount: string;
  } | null>(null);
  const [adjustingSaving, setAdjustingSaving] = useState(false);

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

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const collected: Customer[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await customersApi.list({ status: 'ACTIVE', page, pageSize: 100 });
        collected.push(...result.data);
        totalPages = result.meta.totalPages;
        page += 1;
      } while (page <= totalPages && page <= 20);
      setActiveCustomers(collected);
    } catch {
      setActiveCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const goal = dashboard?.goal ?? null;
  const summary = dashboard?.summary;
  const goalCustomers = useMemo(() => dashboard?.customers ?? [], [dashboard]);

  const goalCustomerIds = useMemo(
    () => new Set(goalCustomers.map((item) => item.customerId)),
    [goalCustomers],
  );

  const customersWithoutGoal = useMemo(
    () => activeCustomers.filter((customer) => !goalCustomerIds.has(customer.id)),
    [activeCustomers, goalCustomerIds],
  );

  const filteredPickerCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return activeCustomers;
    return activeCustomers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) || customer.phone.includes(term),
    );
  }, [activeCustomers, customerSearch]);

  function openCreate() {
    setForm({
      month,
      totalAmount: goal ? String(goal.totalAmount) : '',
      distributionMode: goal?.distributionMode ?? 'EQUAL',
      historicalMonths: '3',
      customerIds:
        goalCustomers.length > 0
          ? goalCustomers.map((item) => item.customerId)
          : activeCustomers.map((customer) => customer.id),
    });
    setCustomerSearch('');
    setModalOpen(true);
  }

  function toggleCustomer(customerId: string) {
    setForm((current) => ({
      ...current,
      customerIds: current.customerIds.includes(customerId)
        ? current.customerIds.filter((id) => id !== customerId)
        : [...current.customerIds, customerId],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.customerIds.length === 0) {
      setError('Selecione ao menos um cliente cadastrado para receber a meta.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await goalsApi.upsert({
        month: form.month,
        totalAmount: Number(form.totalAmount),
        distributionMode: form.distributionMode,
        historicalMonths: Number(form.historicalMonths),
        customerIds: form.customerIds,
      });
      setNotice(`Meta salva para ${form.customerIds.length} cliente(s).`);
      setModalOpen(false);
      setMonth(form.month);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a meta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjustSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjusting || !goal) return;

    setAdjustingSaving(true);
    setError(null);
    try {
      await goalsApi.updateCustomerGoal(goal.id, adjusting.customerId, Number(adjusting.amount));
      setNotice(`Meta de ${adjusting.name} atualizada.`);
      setAdjusting(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ajustar a meta do cliente.');
    } finally {
      setAdjustingSaving(false);
    }
  }

  async function handleDeleteGoal() {
    if (!goal) return;
    if (!window.confirm(`Excluir a meta de ${formatCurrency(goal.totalAmount)} deste mês?`)) return;

    setError(null);
    try {
      await goalsApi.remove(goal.id);
      setNotice('Meta do mês excluída.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a meta.');
    }
  }

  const perCustomerPreview =
    form.customerIds.length > 0 && Number(form.totalAmount) > 0
      ? Number(form.totalAmount) / form.customerIds.length
      : 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Carteira"
        title="Metas"
        description="Defina a meta do mês escolhendo os clientes cadastrados que vão participar."
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
            {goal && (
              <button
                className="button button--quiet button--small"
                type="button"
                onClick={() => void handleDeleteGoal()}
              >
                Excluir meta
              </button>
            )}
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
              <strong className="summary-card__value">{formatCurrency(goal?.totalAmount ?? 0)}</strong>
              <span className="summary-card__meta">
                {goal ? `${goal.completionPercentage.toFixed(1)}% concluído` : 'Nenhuma meta definida'}
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
            title="Clientes com meta"
            description={
              goal
                ? `${goalCustomers.length} cliente(s) • distribuição ${
                    goal.distributionMode === 'EQUAL' ? 'equilibrada' : 'histórica'
                  }`
                : 'Nenhuma meta definida para este mês.'
            }
            actions={
              goal && (
                <button className="button button--secondary button--small" type="button" onClick={openCreate}>
                  Trocar clientes
                </button>
              )
            }
          >
            {goalCustomers.length === 0 ? (
              <EmptyState
                title="Nenhum cliente com meta"
                description="Clique em “Definir meta” para escolher os clientes cadastrados."
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
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {goalCustomers.map((item) => (
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
                        <td className="table-actions">
                          <button
                            className="button button--quiet button--small"
                            type="button"
                            onClick={() =>
                              setAdjusting({
                                customerId: item.customerId,
                                name: item.customer.name,
                                amount: String(item.targetAmount),
                              })
                            }
                          >
                            Ajustar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {customersWithoutGoal.length > 0 && (
            <Panel
              title="Clientes cadastrados sem meta"
              description={`${customersWithoutGoal.length} cliente(s) ativo(s) fora da meta deste mês`}
            >
              <div className="customer-picker__list customer-picker__list--compact">
                {customersWithoutGoal.slice(0, 12).map((customer) => (
                  <span key={customer.id} className="customer-chip">
                    {customer.name}
                    <span className="customer-chip__meta">{customer.phone}</span>
                  </span>
                ))}
                {customersWithoutGoal.length > 12 && (
                  <span className="customer-chip customer-chip--more">
                    +{customersWithoutGoal.length - 12} outro(s)
                  </span>
                )}
              </div>
              <p className="field-hint">
                Para incluir esses clientes, clique em “Trocar clientes” e marque os desejados.
              </p>
            </Panel>
          )}
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

            <div className="field-group">
              <div className="customer-picker__header">
                <label htmlFor="goal-customer-search">Clientes da meta</label>
                <span className="customer-picker__count">
                  {form.customerIds.length} de {activeCustomers.length} selecionado(s)
                </span>
              </div>

              <input
                id="goal-customer-search"
                className="filter-bar__input"
                type="search"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Buscar cliente cadastrado pelo nome ou telefone"
              />

              <div className="customer-picker__actions">
                <button
                  className="button button--quiet button--small"
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      customerIds: filteredPickerCustomers.map((customer) => customer.id),
                    })
                  }
                >
                  Marcar todos
                </button>
                <button
                  className="button button--quiet button--small"
                  type="button"
                  onClick={() => setForm({ ...form, customerIds: [] })}
                >
                  Limpar
                </button>
              </div>

              <div className="customer-picker__list">
                {customersLoading ? (
                  <p className="table-loading">Carregando clientes...</p>
                ) : filteredPickerCustomers.length === 0 ? (
                  <p className="field-hint">
                    Nenhum cliente ativo cadastrado.{' '}
                    <a href="/clientes">Cadastrar cliente</a>
                  </p>
                ) : (
                  filteredPickerCustomers.map((customer) => (
                    <label key={customer.id} className="customer-picker__item">
                      <input
                        type="checkbox"
                        checked={form.customerIds.includes(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
                      />
                      <span className="customer-picker__info">
                        <strong>{customer.name}</strong>
                        <span className="customer-chip__meta">
                          {customer.phone}
                          {customer.city ? ` • ${customer.city}` : ''}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>

              {form.customerIds.length > 0 && Number(form.totalAmount) > 0 && (
                <p className="goal-preview">
                  {form.distributionMode === 'EQUAL'
                    ? `Cada cliente recebe ${formatCurrency(perCustomerPreview)} (divisão igual).`
                    : `O valor será dividido pelo histórico de compras dos ${form.customerIds.length} cliente(s).`}
                </p>
              )}
            </div>

            <p className="field-hint">
              Ao salvar, os valores por cliente são recalculados. Use “Ajustar” na tabela para
              alterar um cliente específico depois.
            </p>

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

      {adjusting && (
        <Modal title={`Meta de ${adjusting.name}`} onClose={() => setAdjusting(null)}>
          <form className="form-stack" onSubmit={handleAdjustSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="adjust-amount">Valor da meta do cliente (R$)</label>
              <div className="input-wrap">
                <input
                  id="adjust-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjusting.amount}
                  onChange={(event) => setAdjusting({ ...adjusting, amount: event.target.value })}
                  required
                />
              </div>
              <span className="field-hint">
                O total da meta do mês será recalculado com a soma dos valores dos clientes.
              </span>
            </div>

            <div className="modal__footer">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setAdjusting(null)}
              >
                Cancelar
              </button>
              <button className="button button--primary" type="submit" disabled={adjustingSaving}>
                {adjustingSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

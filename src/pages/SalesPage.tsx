import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { customersApi, salesApi, type Customer, type Sale, type SaleInput } from '../api/resources';
import { AppShell } from '../components/AppShell';
import {
  Badge,
  EmptyState,
  Feedback,
  Modal,
  PageHeader,
  Pagination,
  Panel,
} from '../components/ui';
import { formatCurrency, formatDate } from '../utils/format';

interface FormState {
  customerId: string;
  soldAt: string;
  amount: string;
  observation: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    customerId: '',
    soldAt: today(),
    amount: '',
    observation: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await salesApi.list({ page, pageSize: 20 });
      setSales(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as vendas.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void customersApi
      .list({ pageSize: 100 })
      .then((result) => setCustomers(result.data))
      .catch(() => setCustomers([]));
  }, []);

  function openCreate() {
    setForm({ customerId: '', soldAt: today(), amount: '', observation: '' });
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: SaleInput = {
        customerId: form.customerId,
        soldAt: new Date(form.soldAt).toISOString(),
        amount: Number(form.amount),
        observation: form.observation.trim() || null,
      };
      await salesApi.create(input);
      setNotice('Venda registrada com sucesso.');
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a venda.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sale: Sale) {
    const confirmed = window.confirm(
      `Excluir a venda de ${formatCurrency(sale.amount)} de ${sale.customer?.name ?? 'cliente'}?`,
    );
    if (!confirmed) return;

    setError(null);
    try {
      await salesApi.remove(sale.id);
      setNotice('Venda excluída.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a venda.');
    }
  }

  const total = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Carteira"
        title="Vendas"
        description="Registre e acompanhe as vendas dos seus clientes."
        actions={
          <button className="button button--primary" type="button" onClick={openCreate}>
            Nova venda
          </button>
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <Panel
        title="Histórico de vendas"
        description={`${meta.total} venda(s) · total de ${formatCurrency(total)} nesta página`}
      >
        {loading ? (
          <p className="table-loading">Carregando vendas...</p>
        ) : sales.length === 0 ? (
          <EmptyState
            title="Nenhuma venda registrada"
            description="Registre a primeira venda para acompanhar o faturamento da carteira."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Origem</th>
                    <th>Observação</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <strong>{sale.customer?.name ?? '—'}</strong>
                        <span className="table-cell__meta">{sale.customer?.phone ?? ''}</span>
                      </td>
                      <td>{formatDate(sale.soldAt)}</td>
                      <td>
                        <strong>{formatCurrency(sale.amount)}</strong>
                      </td>
                      <td>
                        <Badge tone={sale.source === 'IMPORT' ? 'info' : 'neutral'}>
                          {sale.source === 'IMPORT' ? 'Importação' : 'Manual'}
                        </Badge>
                      </td>
                      <td>{sale.observation ?? '—'}</td>
                      <td className="table-actions">
                        <button
                          className="button button--quiet button--small"
                          type="button"
                          onClick={() => void handleDelete(sale)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onChange={setPage}
            />
          </>
        )}
      </Panel>

      {modalOpen && (
        <Modal title="Nova venda" onClose={() => setModalOpen(false)}>
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="sale-customer">Cliente</label>
              <div className="input-wrap">
                <select
                  id="sale-customer"
                  value={form.customerId}
                  onChange={(event) => setForm({ ...form, customerId: event.target.value })}
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} — {customer.phone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field-group">
                <label htmlFor="sale-date">Data da venda</label>
                <div className="input-wrap">
                  <input
                    id="sale-date"
                    type="date"
                    value={form.soldAt}
                    onChange={(event) => setForm({ ...form, soldAt: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="sale-amount">Valor (R$)</label>
                <div className="input-wrap">
                  <input
                    id="sale-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="sale-observation">Observação</label>
              <div className="input-wrap">
                <textarea
                  id="sale-observation"
                  value={form.observation}
                  onChange={(event) => setForm({ ...form, observation: event.target.value })}
                  placeholder="Detalhes da venda"
                  rows={3}
                />
              </div>
            </div>

            <div className="modal__footer">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar venda'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

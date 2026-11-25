import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  customersApi,
  type Customer,
  type CustomerInput,
  type CustomerStatus,
} from '../api/resources';
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
import { formatDate } from '../utils/format';

interface FormState {
  name: string;
  phone: string;
  city: string;
  notes: string;
  status: CustomerStatus;
  nextContactAt: string;
}

const emptyForm: FormState = {
  name: '',
  phone: '',
  city: '',
  notes: '',
  status: 'ACTIVE',
  nextContactAt: '',
};

function toForm(customer: Customer): FormState {
  return {
    name: customer.name,
    phone: customer.phone,
    city: customer.city ?? '',
    notes: customer.notes ?? '',
    status: customer.status,
    nextContactAt: customer.nextContactAt ? customer.nextContactAt.slice(0, 10) : '',
  };
}

function toInput(form: FormState): CustomerInput {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    city: form.city.trim() || null,
    notes: form.notes.trim() || null,
    status: form.status,
    nextContactAt: form.nextContactAt ? new Date(form.nextContactAt).toISOString() : null,
  };
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customersApi.list({
        search: search.trim() || undefined,
        status: status || undefined,
        page,
        pageSize: 20,
      });
      setCustomers(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm(toForm(customer));
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await customersApi.update(editing.id, toInput(form));
        setNotice('Cliente atualizado com sucesso.');
      } else {
        await customersApi.create(toInput(form));
        setNotice('Cliente cadastrado com sucesso.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(`Excluir o cliente "${customer.name}"?`);
    if (!confirmed) return;

    setError(null);
    try {
      await customersApi.remove(customer.id);
      setNotice('Cliente excluído.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o cliente.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Carteira"
        title="Clientes"
        description="Gerencie sua base de clientes, contatos e próximas ações."
        actions={
          <button className="button button--primary" type="button" onClick={openCreate}>
            Novo cliente
          </button>
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <Panel
        title="Lista de clientes"
        description={`${meta.total} cliente(s) na carteira`}
        actions={
          <div className="filter-bar">
            <input
              className="filter-bar__input"
              type="search"
              value={search}
              placeholder="Buscar por nome ou telefone"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Buscar clientes"
            />
            <select
              className="filter-bar__select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CustomerStatus | '');
                setPage(1);
              }}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="ACTIVE">Ativos</option>
              <option value="BLOCKED">Bloqueados</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <p className="table-loading">Carregando clientes...</p>
        ) : customers.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Cadastre o primeiro cliente para começar a organizar sua carteira."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Cidade</th>
                    <th>Status</th>
                    <th>Última compra</th>
                    <th>Próximo contato</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <strong>{customer.name}</strong>
                        {customer.owner && (
                          <span className="table-cell__meta">Resp.: {customer.owner.name}</span>
                        )}
                      </td>
                      <td>{customer.phone}</td>
                      <td>{customer.city ?? '—'}</td>
                      <td>
                        <Badge tone={customer.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {customer.status === 'ACTIVE' ? 'Ativo' : 'Bloqueado'}
                        </Badge>
                      </td>
                      <td>{formatDate(customer.lastPurchaseAt)}</td>
                      <td>{formatDate(customer.nextContactAt)}</td>
                      <td className="table-actions">
                        <button
                          className="button button--quiet button--small"
                          type="button"
                          onClick={() => openEdit(customer)}
                        >
                          Editar
                        </button>
                        <button
                          className="button button--quiet button--small"
                          type="button"
                          onClick={() => void handleDelete(customer)}
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
        <Modal
          title={editing ? 'Editar cliente' : 'Novo cliente'}
          onClose={() => setModalOpen(false)}
        >
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="customer-name">Nome</label>
              <div className="input-wrap">
                <input
                  id="customer-name"
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Nome do cliente"
                  minLength={2}
                  maxLength={160}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="customer-phone">Telefone</label>
              <div className="input-wrap">
                <input
                  id="customer-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="11999999999"
                  required
                />
              </div>
              <span className="field-hint">Informe DDD + número (10 a 15 dígitos).</span>
            </div>

            <div className="form-row">
              <div className="field-group">
                <label htmlFor="customer-city">Cidade</label>
                <div className="input-wrap">
                  <input
                    id="customer-city"
                    type="text"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                    placeholder="São Paulo"
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="customer-status">Status</label>
                <div className="input-wrap">
                  <select
                    id="customer-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as CustomerStatus })
                    }
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="BLOCKED">Bloqueado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="customer-next">Próximo contato</label>
              <div className="input-wrap">
                <input
                  id="customer-next"
                  type="date"
                  value={form.nextContactAt}
                  onChange={(event) => setForm({ ...form, nextContactAt: event.target.value })}
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="customer-notes">Observações</label>
              <div className="input-wrap">
                <textarea
                  id="customer-notes"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Anotações sobre o cliente"
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
                {saving ? 'Salvando...' : 'Salvar cliente'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

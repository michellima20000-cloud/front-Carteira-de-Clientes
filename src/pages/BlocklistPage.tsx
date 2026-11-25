import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { blocklistApi, type BlocklistEntry } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { EmptyState, Feedback, PageHeader, Panel } from '../components/ui';
import { formatDate } from '../utils/format';

export function BlocklistPage() {
  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await blocklistApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a lista.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await blocklistApi.create({ phone: phone.trim(), reason: reason.trim() || null });
      setNotice('Número bloqueado.');
      setPhone('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível bloquear o número.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: BlocklistEntry) {
    if (!window.confirm(`Remover ${entry.phone} da lista de bloqueados?`)) return;

    setError(null);
    try {
      await blocklistApi.remove(entry.id);
      setNotice('Número removido da lista.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover o número.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Atendimento"
        title="Bloqueados"
        description="Impeça o contato com números que não devem receber mensagens."
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <Panel title="Bloquear número" description="Informe DDD + número (10 a 15 dígitos).">
        <form className="filter-bar filter-bar--form" onSubmit={handleSubmit}>
          <input
            className="filter-bar__input"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="11999999999"
            aria-label="Telefone para bloquear"
            required
          />
          <input
            className="filter-bar__input"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo do bloqueio"
          />
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Bloqueando...' : 'Bloquear'}
          </button>
        </form>
      </Panel>

      <Panel title="Números bloqueados" description={`${entries.length} número(s)`}>
        {loading ? (
          <p className="table-loading">Carregando lista...</p>
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nenhum número bloqueado"
            description="Bloqueie números para evitar contato indesejado."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Motivo</th>
                  <th>Bloqueado em</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.phone}</strong>
                    </td>
                    <td>{entry.reason ?? '—'}</td>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td className="table-actions">
                      <button
                        className="button button--quiet button--small"
                        type="button"
                        onClick={() => void handleDelete(entry)}
                      >
                        Remover
                      </button>
                    </td>
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

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { quickRepliesApi, type QuickReply, type QuickReplyInput } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, Feedback, Modal, PageHeader, Panel } from '../components/ui';

interface FormState {
  name: string;
  trigger: string;
  text: string;
  active: boolean;
}

const emptyForm: FormState = { name: '', trigger: '', text: '', active: true };

export function QuickRepliesPage() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReplies(await quickRepliesApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as respostas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(reply: QuickReply) {
    setEditing(reply);
    setForm({
      name: reply.name,
      trigger: reply.trigger ?? '',
      text: reply.text,
      active: reply.active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: QuickReplyInput = {
        name: form.name.trim(),
        trigger: form.trigger.trim() || null,
        text: form.text.trim(),
        active: form.active,
      };
      if (editing) {
        await quickRepliesApi.update(editing.id, input);
        setNotice('Resposta rápida atualizada.');
      } else {
        await quickRepliesApi.create(input);
        setNotice('Resposta rápida criada.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a resposta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reply: QuickReply) {
    if (!window.confirm(`Excluir a resposta rápida "${reply.name}"?`)) return;

    setError(null);
    try {
      await quickRepliesApi.remove(reply.id);
      setNotice('Resposta rápida excluída.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a resposta.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Atendimento"
        title="Respostas rápidas"
        description="Crie atalhos de texto para responder mais rápido no WhatsApp."
        actions={
          <button className="button button--primary" type="button" onClick={openCreate}>
            Nova resposta
          </button>
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <Panel title="Biblioteca de respostas" description={`${replies.length} resposta(s)`}>
        {loading ? (
          <p className="table-loading">Carregando respostas...</p>
        ) : replies.length === 0 ? (
          <EmptyState
            title="Nenhuma resposta rápida"
            description="Crie respostas prontas para usar durante o atendimento."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Gatilho</th>
                  <th>Texto</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {replies.map((reply) => (
                  <tr key={reply.id}>
                    <td>
                      <strong>{reply.name}</strong>
                    </td>
                    <td>{reply.trigger ?? '—'}</td>
                    <td className="table-cell__truncate">{reply.text}</td>
                    <td>
                      <Badge tone={reply.active ? 'success' : 'neutral'}>
                        {reply.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="table-actions">
                      <button
                        className="button button--quiet button--small"
                        type="button"
                        onClick={() => openEdit(reply)}
                      >
                        Editar
                      </button>
                      <button
                        className="button button--quiet button--small"
                        type="button"
                        onClick={() => void handleDelete(reply)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {modalOpen && (
        <Modal
          title={editing ? 'Editar resposta rápida' : 'Nova resposta rápida'}
          onClose={() => setModalOpen(false)}
        >
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="field-group">
                <label htmlFor="reply-name">Nome</label>
                <div className="input-wrap">
                  <input
                    id="reply-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Ex: Boas-vindas"
                    required
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="reply-trigger">Gatilho</label>
                <div className="input-wrap">
                  <input
                    id="reply-trigger"
                    type="text"
                    value={form.trigger}
                    onChange={(event) => setForm({ ...form, trigger: event.target.value })}
                    placeholder="oi, olá"
                  />
                </div>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="reply-text">Texto</label>
              <div className="input-wrap">
                <textarea
                  id="reply-text"
                  value={form.text}
                  onChange={(event) => setForm({ ...form, text: event.target.value })}
                  placeholder="Mensagem que será enviada"
                  rows={4}
                  required
                />
              </div>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              <span>Resposta ativa</span>
            </label>

            <div className="modal__footer">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

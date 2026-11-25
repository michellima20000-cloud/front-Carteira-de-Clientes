import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  templatesApi,
  type MessageTemplate,
  type TemplateInput,
  type TemplateStatus,
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

interface FormState {
  name: string;
  content: string;
  category: string;
  status: TemplateStatus;
}

const emptyForm: FormState = { name: '', content: '', category: '', status: 'DRAFT' };

export function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await templatesApi.list({
        search: search.trim() || undefined,
        page,
        pageSize: 20,
      });
      setTemplates(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os templates.');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(template: MessageTemplate) {
    setEditing(template);
    setForm({
      name: template.name,
      content: template.content,
      category: template.category ?? '',
      status: template.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: TemplateInput = {
        name: form.name.trim(),
        content: form.content.trim(),
        category: form.category.trim() || null,
        status: form.status,
      };
      if (editing) {
        await templatesApi.update(editing.id, input);
        setNotice('Template atualizado.');
      } else {
        await templatesApi.create(input);
        setNotice('Template criado.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o template.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: MessageTemplate) {
    if (!window.confirm(`Excluir o template "${template.name}"?`)) return;

    setError(null);
    try {
      await templatesApi.remove(template.id);
      setNotice('Template excluído.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o template.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Atendimento"
        title="Templates"
        description="Modelos de mensagem reutilizáveis para campanhas e reativação."
        actions={
          <button className="button button--primary" type="button" onClick={openCreate}>
            Novo template
          </button>
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <Panel
        title="Modelos de mensagem"
        description={`${meta.total} template(s)`}
        actions={
          <input
            className="filter-bar__input"
            type="search"
            value={search}
            placeholder="Buscar template"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            aria-label="Buscar templates"
          />
        }
      >
        {loading ? (
          <p className="table-loading">Carregando templates...</p>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Nenhum template"
            description="Crie modelos de mensagem para reutilizar no atendimento."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Conteúdo</th>
                    <th>Status</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td>
                        <strong>{template.name}</strong>
                      </td>
                      <td>{template.category ?? '—'}</td>
                      <td className="table-cell__truncate">{template.content}</td>
                      <td>
                        <Badge tone={template.status === 'APPROVED' ? 'success' : 'warning'}>
                          {template.status === 'APPROVED' ? 'Aprovado' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="table-actions">
                        <button
                          className="button button--quiet button--small"
                          type="button"
                          onClick={() => openEdit(template)}
                        >
                          Editar
                        </button>
                        <button
                          className="button button--quiet button--small"
                          type="button"
                          onClick={() => void handleDelete(template)}
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
          title={editing ? 'Editar template' : 'Novo template'}
          onClose={() => setModalOpen(false)}
        >
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="field-group">
                <label htmlFor="template-name">Nome</label>
                <div className="input-wrap">
                  <input
                    id="template-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Ex: Reativação - 30 dias"
                    required
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="template-category">Categoria</label>
                <div className="input-wrap">
                  <input
                    id="template-category"
                    type="text"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    placeholder="Reativação"
                  />
                </div>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="template-content">Conteúdo</label>
              <div className="input-wrap">
                <textarea
                  id="template-content"
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="Mensagem do template"
                  rows={5}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="template-status">Status</label>
              <div className="input-wrap">
                <select
                  id="template-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as TemplateStatus })
                  }
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="APPROVED">Aprovado</option>
                </select>
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
                {saving ? 'Salvando...' : 'Salvar template'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

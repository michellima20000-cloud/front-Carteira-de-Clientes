import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  conversationsApi,
  whatsappApi,
  type Conversation,
  type ConversationStatus,
  type Message,
} from '../api/resources';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, Feedback, PageHeader, Pagination, Panel } from '../components/ui';
import { formatDateTime } from '../utils/format';

const STATUS_LABELS: Record<ConversationStatus, string> = {
  BOT: 'Bot',
  AGUARDANDO_HUMANO: 'Aguardando humano',
  EM_ATENDIMENTO: 'Em atendimento',
  FINALIZADA: 'Finalizada',
};

function statusTone(status: ConversationStatus): string {
  if (status === 'EM_ATENDIMENTO') return 'info';
  if (status === 'AGUARDANDO_HUMANO') return 'warning';
  if (status === 'FINALIZADA') return 'neutral';
  return 'success';
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [status, setStatus] = useState<ConversationStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await conversationsApi.list({
        status: status || undefined,
        search: search.trim() || undefined,
        page,
        pageSize: 20,
      });
      setConversations(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as conversas.');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void whatsappApi
      .getConfig()
      .then((result) => setWhatsappConnected(result.connected))
      .catch(() => setWhatsappConnected(null));
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const result = await conversationsApi.messages(conversationId);
      setMessages(result.data);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  function openConversation(conversation: Conversation) {
    setSelected(conversation);
    void loadMessages(conversation.id);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;

    setSending(true);
    setError(null);
    try {
      await conversationsApi.sendMessage(selected.id, draft.trim());
      setDraft('');
      await loadMessages(selected.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(next: ConversationStatus) {
    if (!selected) return;
    setError(null);
    try {
      const updated = await conversationsApi.updateStatus(selected.id, next);
      setSelected(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o status.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Atendimento"
        title="Conversas"
        description="Acompanhe o atendimento das conversas de WhatsApp da sua carteira."
        actions={
          <a className="button button--secondary" href="/whatsapp">
            {whatsappConnected ? 'Configurar WhatsApp' : 'Conectar WhatsApp'}
          </a>
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}

      {whatsappConnected === false && (
        <div className="connect-banner">
          <div>
            <strong>Conecte seu WhatsApp</strong>
            <p>
              As mensagens recebidas pelo seu número só aparecem aqui depois de conectar o
              WhatsApp Business.
            </p>
          </div>
          <a className="button button--primary button--small" href="/whatsapp">
            Conectar agora
          </a>
        </div>
      )}

      <Panel
        title="Caixa de entrada"
        description={`${meta.total} conversa(s)`}
        actions={
          <div className="filter-bar">
            <input
              className="filter-bar__input"
              type="search"
              value={search}
              placeholder="Buscar conversa"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Buscar conversas"
            />
            <select
              className="filter-bar__select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ConversationStatus | '');
                setPage(1);
              }}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_LABELS) as ConversationStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {loading ? (
          <p className="table-loading">Carregando conversas...</p>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="Nenhuma conversa"
            description="As conversas recebidas pelo WhatsApp aparecerão aqui."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Última mensagem</th>
                    <th>Status</th>
                    <th>Quando</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conversation) => (
                    <tr
                      key={conversation.id}
                      className={selected?.id === conversation.id ? 'is-selected' : undefined}
                    >
                      <td>
                        <strong>{conversation.customer?.name ?? '—'}</strong>
                        <span className="table-cell__meta">
                          {conversation.customer?.phone ?? ''}
                        </span>
                      </td>
                      <td className="table-cell__truncate">
                        {conversation.lastMessagePreview ?? 'Sem mensagens'}
                      </td>
                      <td>
                        <Badge tone={statusTone(conversation.status)}>
                          {STATUS_LABELS[conversation.status]}
                        </Badge>
                      </td>
                      <td>{formatDateTime(conversation.lastMessageAt)}</td>
                      <td className="table-actions">
                        <button
                          className="button button--quiet button--small"
                          type="button"
                          onClick={() => openConversation(conversation)}
                        >
                          Abrir
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

      {selected && (
        <Panel
          title={`Conversa com ${selected.customer?.name ?? 'cliente'}`}
          description={selected.customer?.phone}
          actions={
            <select
              className="filter-bar__select"
              value={selected.status}
              onChange={(event) => void changeStatus(event.target.value as ConversationStatus)}
              aria-label="Alterar status da conversa"
            >
              {(Object.keys(STATUS_LABELS) as ConversationStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          }
        >
          <div className="chat">
            <div className="chat__messages">
              {messagesLoading ? (
                <p className="table-loading">Carregando mensagens...</p>
              ) : messages.length === 0 ? (
                <EmptyState title="Sem mensagens" description="Envie a primeira mensagem." />
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat__message chat__message--${message.direction.toLowerCase()}`}
                  >
                    <p>{message.body}</p>
                    <span>{formatDateTime(message.sentAt)}</span>
                  </div>
                ))
              )}
            </div>

            <form className="chat__composer" onSubmit={handleSend}>
              <input
                className="filter-bar__input"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreva uma mensagem"
                aria-label="Mensagem"
              />
              <button
                className="button button--primary"
                type="submit"
                disabled={sending || !draft.trim()}
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </div>
        </Panel>
      )}
    </AppShell>
  );
}

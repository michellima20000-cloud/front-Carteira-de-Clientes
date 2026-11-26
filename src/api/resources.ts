import { apiRequest } from './http';

/* ------------------------------------------------------------------ */
/* Tipos compartilhados                                                */
/* ------------------------------------------------------------------ */

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export type CustomerStatus = 'ACTIVE' | 'BLOCKED';
export type SaleSource = 'MANUAL' | 'IMPORT';
export type GoalDistributionMode = 'EQUAL' | 'HISTORICAL';
export type ConversationStatus = 'BOT' | 'AGUARDANDO_HUMANO' | 'EM_ATENDIMENTO' | 'FINALIZADA';
export type TemplateStatus = 'DRAFT' | 'APPROVED';

export interface Owner {
  id: string;
  name: string;
  email: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  notes: string | null;
  status: CustomerStatus;
  lastPurchaseAt: string | null;
  nextContactAt: string | null;
  createdAt: string;
  owner: Owner | null;
}

export interface InactiveCustomer extends Customer {
  daysSinceLastPurchase: number | null;
}

export interface Sale {
  id: string;
  customerId: string;
  soldAt: string;
  amount: number | string;
  observation: string | null;
  source: SaleSource;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  createdBy: Owner | null;
}

export interface GoalCustomerItem {
  id: string;
  customerId: string;
  amount: number | string;
  customer: {
    id: string;
    name: string;
    phone: string;
    status: CustomerStatus;
    owner: { id: string; name: string } | null;
  };
}

export interface MonthlyGoal {
  id: string;
  month: string;
  totalAmount: number | string;
  distributionMode: GoalDistributionMode;
  createdAt: string;
  updatedAt: string;
  customers?: GoalCustomerItem[];
}

export interface GoalDashboard {
  month: string;
  goal: {
    id: string;
    totalAmount: number;
    distributionMode: GoalDistributionMode;
    realizedAmount: number;
    remainingAmount: number;
    completionPercentage: number;
  } | null;
  summary: {
    totalSalesCount: number;
    totalRealizedAmount: number;
    customersWithGoalCount: number;
    customersHitGoalCount: number;
  };
  customers: Array<{
    customerId: string;
    customer: {
      id: string;
      name: string;
      phone: string;
      status: CustomerStatus;
      owner: { id: string; name: string } | null;
    };
    targetAmount: number;
    realizedAmount: number;
    remainingAmount: number;
    completionPercentage: number;
    hitGoal: boolean;
  }>;
}

export interface Conversation {
  id: string;
  customerId: string;
  assignedUserId: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string };
  assignedUser?: Owner | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  body: string;
  sentAt: string;
  sender?: Owner | null;
}

export interface QuickReply {
  id: string;
  name: string;
  trigger: string | null;
  text: string;
  active: boolean;
}

export interface BlocklistEntry {
  id: string;
  phone: string;
  reason: string | null;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
  status: TemplateStatus;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  active: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function paged<T>(path: string, signal?: AbortSignal): Promise<Paged<T>> {
  const response = await apiRequest<Paged<T>>(path, { method: 'GET', signal, unwrap: false });
  return {
    data: response.data ?? [],
    meta: response.meta ?? { page: 1, pageSize: 50, total: 0, totalPages: 1 },
  };
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

export interface CustomerInput {
  name: string;
  phone: string;
  city?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
  nextContactAt?: string | null;
}

export const customersApi = {
  list(
    filters: {
      search?: string;
      status?: CustomerStatus;
      ownerId?: string;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ) {
    return paged<Customer>(`/customers${query(filters)}`, signal);
  },

  inactive(
    filters: {
      days?: number;
      includeNeverPurchased?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ) {
    return paged<InactiveCustomer>(`/customers/inactive${query(filters)}`, signal);
  },

  create(input: CustomerInput, signal?: AbortSignal) {
    return apiRequest<Customer>('/customers', {
      method: 'POST',
      body: input,
      signal,
    });
  },

  update(id: string, input: Partial<CustomerInput>, signal?: AbortSignal) {
    return apiRequest<Customer>(`/customers/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
    });
  },

  remove(id: string, signal?: AbortSignal) {
    return apiRequest<void>(`/customers/${id}`, { method: 'DELETE', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Vendas                                                              */
/* ------------------------------------------------------------------ */

export interface SaleInput {
  customerId: string;
  soldAt: string;
  amount: number;
  observation?: string | null;
}

export const salesApi = {
  list(
    filters: {
      customerId?: string;
      startDate?: string;
      endDate?: string;
      source?: SaleSource;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ) {
    return paged<Sale>(`/sales${query(filters)}`, signal);
  },

  create(input: SaleInput, signal?: AbortSignal) {
    return apiRequest<Sale>('/sales', { method: 'POST', body: input, signal });
  },

  update(id: string, input: Partial<Omit<SaleInput, 'customerId'>>, signal?: AbortSignal) {
    return apiRequest<Sale>(`/sales/${id}`, { method: 'PATCH', body: input, signal });
  },

  remove(id: string, signal?: AbortSignal) {
    return apiRequest<void>(`/sales/${id}`, { method: 'DELETE', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Metas                                                               */
/* ------------------------------------------------------------------ */

export const goalsApi = {
  list(signal?: AbortSignal) {
    return apiRequest<MonthlyGoal[]>('/goals', { method: 'GET', signal });
  },

  dashboard(month?: string, signal?: AbortSignal) {
    return apiRequest<GoalDashboard>(`/goals/dashboard${query({ month })}`, {
      method: 'GET',
      signal,
    });
  },

  upsert(
    input: {
      month: string;
      totalAmount: number;
      distributionMode: GoalDistributionMode;
      customerIds?: string[];
      historicalMonths?: number;
    },
    signal?: AbortSignal,
  ) {
    return apiRequest<GoalDashboard>('/goals', { method: 'PUT', body: input, signal });
  },

  updateCustomerGoal(goalId: string, customerId: string, amount: number, signal?: AbortSignal) {
    return apiRequest<{
      customerGoalId: string;
      amount: number;
      monthlyGoalTotalAmount: number;
    }>(`/goals/${goalId}/customers/${customerId}`, {
      method: 'PATCH',
      body: { amount },
      signal,
    });
  },

  remove(goalId: string, signal?: AbortSignal) {
    return apiRequest<void>(`/goals/${goalId}`, { method: 'DELETE', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Conversas (WhatsApp)                                                */
/* ------------------------------------------------------------------ */

export const conversationsApi = {
  list(
    filters: {
      status?: ConversationStatus;
      assignedUserId?: string;
      customerId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ) {
    return paged<Conversation>(`/conversations${query(filters)}`, signal);
  },

  get(id: string, signal?: AbortSignal) {
    return apiRequest<Conversation>(`/conversations/${id}`, { method: 'GET', signal });
  },

  messages(id: string, signal?: AbortSignal) {
    return paged<Message>(`/conversations/${id}/messages`, signal);
  },

  sendMessage(id: string, body: string, signal?: AbortSignal) {
    return apiRequest<Message>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: { body },
      signal,
    });
  },

  updateStatus(
    id: string,
    status: ConversationStatus,
    assignedUserId?: string | null,
    signal?: AbortSignal,
  ) {
    return apiRequest<Conversation>(`/conversations/${id}/status`, {
      method: 'PATCH',
      body: { status, assignedUserId },
      signal,
    });
  },

  assign(id: string, assignedUserId: string | null, signal?: AbortSignal) {
    return apiRequest<Conversation>(`/conversations/${id}/assign`, {
      method: 'PATCH',
      body: { assignedUserId },
      signal,
    });
  },
};

/* ------------------------------------------------------------------ */
/* Respostas rápidas                                                   */
/* ------------------------------------------------------------------ */

export interface QuickReplyInput {
  name: string;
  trigger?: string | null;
  text: string;
  active?: boolean;
}

export const quickRepliesApi = {
  list(signal?: AbortSignal) {
    return apiRequest<QuickReply[]>('/quick-replies', { method: 'GET', signal });
  },

  create(input: QuickReplyInput, signal?: AbortSignal) {
    return apiRequest<QuickReply>('/quick-replies', { method: 'POST', body: input, signal });
  },

  update(id: string, input: Partial<QuickReplyInput>, signal?: AbortSignal) {
    return apiRequest<QuickReply>(`/quick-replies/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
    });
  },

  remove(id: string, signal?: AbortSignal) {
    return apiRequest<void>(`/quick-replies/${id}`, { method: 'DELETE', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Bloqueados                                                          */
/* ------------------------------------------------------------------ */

export const blocklistApi = {
  list(signal?: AbortSignal) {
    return apiRequest<BlocklistEntry[]>('/blocklist', { method: 'GET', signal });
  },

  create(input: { phone: string; reason?: string | null }, signal?: AbortSignal) {
    return apiRequest<BlocklistEntry>('/blocklist', { method: 'POST', body: input, signal });
  },

  remove(id: string, signal?: AbortSignal) {
    return apiRequest<void>(`/blocklist/${id}`, { method: 'DELETE', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Templates e reativação                                              */
/* ------------------------------------------------------------------ */

export interface TemplateInput {
  name: string;
  content: string;
  category?: string | null;
  status?: TemplateStatus;
}

export const templatesApi = {
  list(
    filters: {
      status?: TemplateStatus;
      category?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ) {
    return paged<MessageTemplate>(`/templates${query(filters)}`, signal);
  },

  create(input: TemplateInput, signal?: AbortSignal) {
    return apiRequest<MessageTemplate>('/templates', { method: 'POST', body: input, signal });
  },

  update(id: string, input: Partial<TemplateInput>, signal?: AbortSignal) {
    return apiRequest<MessageTemplate>(`/templates/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
    });
  },

  remove(id: string, signal?: AbortSignal) {
    return apiRequest<void>(`/templates/${id}`, { method: 'DELETE', signal });
  },

  reactivationPreview(
    input: {
      templateId: string;
      inactiveDays: number;
      includeNeverPurchased: boolean;
      customerIds?: string[];
    },
    signal?: AbortSignal,
  ) {
    return apiRequest<{
      eligible: number;
      customers: Array<{ id: string; name: string; phone: string }>;
    }>('/reactivations/preview', { method: 'POST', body: input, signal });
  },

  reactivationDispatch(
    input: {
      templateId: string;
      inactiveDays: number;
      includeNeverPurchased: boolean;
      customerIds?: string[];
    },
    signal?: AbortSignal,
  ) {
    return apiRequest<{ dispatched: number }>('/reactivations/dispatch', {
      method: 'POST',
      body: input,
      signal,
    });
  },
};

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

export interface WhatsappConfig {
  connected: boolean;
  accountId: string;
  webhookUrl: string;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  provider: string | null;
  accessTokenHint: string | null;
  webhookSecret: string | null;
  updatedAt: string | null;
}

export interface WhatsappTestResult {
  valid: boolean;
  detail: string;
  testedAt: string;
}

export type QrSessionStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'AWAITING_SCAN'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface QrSessionState {
  status: QrSessionStatus;
  qr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  error: string | null;
  /** `unavailable` = a sessão não está sendo salva no servidor. */
  storage: 'ok' | 'unavailable';
  /** Detalhe do erro de persistência. */
  storageError?: string | null;
  updatedAt: string;
}

export const whatsappApi = {
  getConfig(signal?: AbortSignal) {
    return apiRequest<WhatsappConfig>('/whatsapp/config', { method: 'GET', signal });
  },

  saveConfig(
    input: {
      phoneNumber: string;
      phoneNumberId?: string | undefined;
      provider?: 'META';
      accessToken: string;
      webhookSecret?: string | undefined;
    },
    signal?: AbortSignal,
  ) {
    return apiRequest<WhatsappConfig>('/whatsapp/config', {
      method: 'PUT',
      body: input,
      signal,
    });
  },

  testConnection(signal?: AbortSignal) {
    return apiRequest<WhatsappTestResult>('/whatsapp/config/test', {
      method: 'POST',
      signal,
    });
  },

  disconnect(signal?: AbortSignal) {
    return apiRequest<void>('/whatsapp/config', { method: 'DELETE', signal });
  },

  getQr(signal?: AbortSignal) {
    return apiRequest<QrSessionState>('/whatsapp/qr', { method: 'GET', signal });
  },

  startQr(signal?: AbortSignal) {
    return apiRequest<QrSessionState>('/whatsapp/qr/start', { method: 'POST', signal });
  },

  refreshQr(signal?: AbortSignal) {
    return apiRequest<QrSessionState>('/whatsapp/qr/refresh', { method: 'POST', signal });
  },

  disconnectQr(signal?: AbortSignal) {
    return apiRequest<QrSessionState>('/whatsapp/qr/disconnect', { method: 'POST', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Equipe                                                              */
/* ------------------------------------------------------------------ */

export const accountsApi = {
  users(signal?: AbortSignal) {
    return apiRequest<TeamUser[]>('/accounts/users', { method: 'GET', signal });
  },
};

/* ------------------------------------------------------------------ */
/* Importação                                                          */
/* ------------------------------------------------------------------ */

interface PreviewResult {
  columns: string[];
  rows: Array<Record<string, string>>;
  summary: { total: number; valid: number; invalid: number };
}

interface CommitResult {
  importedCustomers: number;
  importedSales: number;
  skipped: number;
}

export const importsApi = {
  preview(file: File, columnMapping?: Record<string, string>, signal?: AbortSignal) {
    const form = new FormData();
    form.append('file', file);
    if (columnMapping) {
      form.append('columnMapping', JSON.stringify(columnMapping));
    }
    return apiRequest<{ data: PreviewResult }>('/imports/preview', {
      method: 'POST',
      body: form,
      signal,
      unwrap: false,
    }).then((response) => response.data);
  },

  commit(
    file: File,
    options: {
      skipInvalid: boolean;
      updateExistingCustomers: boolean;
      columnMapping?: Record<string, string>;
    },
    signal?: AbortSignal,
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append('skipInvalid', String(options.skipInvalid));
    form.append('updateExistingCustomers', String(options.updateExistingCustomers));
    if (options.columnMapping) {
      form.append('columnMapping', JSON.stringify(options.columnMapping));
    }
    return apiRequest<{ data: CommitResult }>('/imports/commit', {
      method: 'POST',
      body: form,
      signal,
      unwrap: false,
    }).then((response) => response.data);
  },
};

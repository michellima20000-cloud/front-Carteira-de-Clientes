import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { whatsappApi, type WhatsappConfig, type WhatsappTestResult } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { Badge, EmptyState, Feedback, PageHeader, Panel } from '../components/ui';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="field-group">
      <label htmlFor={`copy-${label}`}>{label}</label>
      <div className="copy-field">
        <input id={`copy-${label}`} className="filter-bar__input" type="text" value={value} readOnly />
        <button className="button button--secondary button--small" type="button" onClick={() => void copy()}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

export function WhatsappPage() {
  const [config, setConfig] = useState<WhatsappConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WhatsappTestResult | null>(null);
  const [form, setForm] = useState({
    phoneNumber: '',
    phoneNumberId: '',
    accessToken: '',
    webhookSecret: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await whatsappApi.getConfig();
      setConfig(result);
      setForm({
        phoneNumber: result.phoneNumber ?? '',
        phoneNumberId: result.phoneNumberId ?? '',
        accessToken: '',
        webhookSecret: result.webhookSecret ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a configuração.');
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
    setNotice(null);
    setTestResult(null);
    try {
      const saved = await whatsappApi.saveConfig({
        phoneNumber: form.phoneNumber.trim(),
        phoneNumberId: form.phoneNumberId.trim() || undefined,
        accessToken: form.accessToken.trim(),
        webhookSecret: form.webhookSecret.trim() || undefined,
      });
      setConfig(saved);
      setForm((current) => ({ ...current, accessToken: '' }));
      setNotice('WhatsApp conectado. Agora cadastre o webhook na Meta.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conectar o WhatsApp.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      setTestResult(await whatsappApi.testConnection());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível testar a conexão.');
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Desconectar o WhatsApp desta conta?')) return;

    setError(null);
    try {
      await whatsappApi.disconnect();
      setNotice('WhatsApp desconectado.');
      setTestResult(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível desconectar o WhatsApp.');
    }
  }

  const connected = config?.connected ?? false;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Atendimento"
        title="Conectar WhatsApp"
        description="Vincule seu número de WhatsApp Business para receber as conversas da sua carteira."
        actions={
          connected ? (
            <button className="button button--quiet" type="button" onClick={() => void handleDisconnect()}>
              Desconectar
            </button>
          ) : undefined
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      {loading ? (
        <Panel title="WhatsApp">
          <p className="table-loading">Carregando configuração...</p>
        </Panel>
      ) : (
        <>
          <Panel
            title="Status da conexão"
            description={connected ? 'WhatsApp conectado nesta conta.' : 'WhatsApp ainda não conectado.'}
            actions={
              <Badge tone={connected ? 'success' : 'warning'}>
                {connected ? 'Conectado' : 'Desconectado'}
              </Badge>
            }
          >
            {connected && config ? (
              <dl className="detail-list">
                <div>
                  <dt>Número</dt>
                  <dd>{config.phoneNumber ?? '—'}</dd>
                </div>
                <div>
                  <dt>Phone Number ID</dt>
                  <dd>{config.phoneNumberId ?? 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Provedor</dt>
                  <dd>{config.provider ?? 'META'}</dd>
                </div>
                <div>
                  <dt>Access token</dt>
                  <dd>{config.accessTokenHint ?? '—'}</dd>
                </div>
                <div>
                  <dt>Atualizado em</dt>
                  <dd>
                    {config.updatedAt
                      ? new Date(config.updatedAt).toLocaleString('pt-BR')
                      : '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyState
                title="Nenhum número conectado"
                description="Preencha os dados abaixo para conectar o seu WhatsApp Business."
              />
            )}
          </Panel>

          <Panel
            title="Dados da conexão"
            description="Token permanent e Phone Number ID vêm do painel da Meta (WhatsApp > API Setup)."
          >
            <form className="form-stack" onSubmit={handleSubmit} noValidate>
              <div className="form-row">
                <div className="field-group">
                  <label htmlFor="wa-phone">Número do WhatsApp</label>
                  <div className="input-wrap">
                    <input
                      id="wa-phone"
                      type="tel"
                      value={form.phoneNumber}
                      onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
                      placeholder="5511999999999"
                      required
                    />
                  </div>
                  <span className="field-hint">Com DDD e código do país, só números.</span>
                </div>

                <div className="field-group">
                  <label htmlFor="wa-phone-id">Phone Number ID (Meta)</label>
                  <div className="input-wrap">
                    <input
                      id="wa-phone-id"
                      type="text"
                      inputMode="numeric"
                      value={form.phoneNumberId}
                      onChange={(event) => setForm({ ...form, phoneNumberId: event.target.value })}
                      placeholder="123456789012345"
                    />
                  </div>
                  <span className="field-hint">Opcional, mas permite validar o token.</span>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="wa-token">Access token permanente</label>
                <div className="input-wrap">
                  <input
                    id="wa-token"
                    type="password"
                    value={form.accessToken}
                    onChange={(event) => setForm({ ...form, accessToken: event.target.value })}
                    placeholder="EAAG..."
                    autoComplete="off"
                    required
                  />
                </div>
                <span className="field-hint">
                  Guardado criptografado no servidor. Nunca é devolvido pela API.
                </span>
              </div>

              <div className="field-group">
                <label htmlFor="wa-secret">Token de verificação do webhook</label>
                <div className="input-wrap">
                  <input
                    id="wa-secret"
                    type="text"
                    value={form.webhookSecret}
                    onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })}
                    placeholder="Deixe em branco para gerar automaticamente"
                  />
                </div>
                <span className="field-hint">
                  Use o mesmo valor no campo “Verify token” da Meta.
                </span>
              </div>

              <div className="form-actions-row">
                <button className="button button--primary" type="submit" disabled={saving}>
                  {saving ? 'Conectando...' : connected ? 'Atualizar conexão' : 'Conectar WhatsApp'}
                </button>
                {connected && (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void handleTest()}
                    disabled={testing}
                  >
                    {testing ? 'Testando...' : 'Testar conexão'}
                  </button>
                )}
              </div>

              {testResult && (
                <p className={testResult.valid ? 'goal-preview' : 'field-error'}>
                  {testResult.valid ? '✓ ' : '✕ '}
                  {testResult.detail}
                </p>
              )}
            </form>
          </Panel>

          <Panel
            title="Cadastro do webhook na Meta"
            description="Use estes valores em WhatsApp > Configuração > Webhooks."
          >
            <CopyField label="URL do webhook" value={config?.webhookUrl ?? ''} />
            <CopyField
              label="Verify token"
              value={config?.webhookSecret ?? form.webhookSecret ?? ''}
            />

            <ol className="step-list">
              <li>
                No <strong>Meta for Developers</strong>, abra sua app de WhatsApp e acesse{' '}
                <strong>WhatsApp {'>'} API Setup</strong>.
              </li>
              <li>
                Copie o <strong>Phone Number ID</strong> e gere um <strong>token permanente</strong>{' '}
                (usuário do sistema) com as permissões <code>whatsapp_business_messaging</code>.
              </li>
              <li>
                Em <strong>Configuração {'>'} Webhooks</strong>, cole a URL acima, informe o mesmo
                verify token e assine o campo <code>messages</code>.
              </li>
              <li>
                Salve a conexão aqui e clique em <strong>Testar conexão</strong> para validar o token.
              </li>
            </ol>
          </Panel>
        </>
      )}
    </AppShell>
  );
}

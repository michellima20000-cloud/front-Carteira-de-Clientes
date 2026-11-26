import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import {
  whatsappApi,
  type QrSessionState,
  type WhatsappConfig,
  type WhatsappTestResult,
} from '../api/resources';
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
        <button
          className="button button--secondary button--small"
          type="button"
          onClick={() => void copy()}
        >
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function QrCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, value, {
      width: 220,
      margin: 1,
      color: { dark: '#0a1a2b', light: '#ffffff' },
    });
  }, [value]);

  return <canvas ref={canvasRef} className="qr-canvas" aria-label="QR Code de conexão" />;
}

const STATUS_LABELS: Record<QrSessionState['status'], string> = {
  IDLE: 'Desconectado',
  CONNECTING: 'Conectando...',
  AWAITING_SCAN: 'Aguardando leitura',
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado',
  ERROR: 'Erro na conexão',
};

export function WhatsappPage() {
  const [tab, setTab] = useState<'qr' | 'meta'>('qr');
  const [qr, setQr] = useState<QrSessionState | null>(null);
  const [config, setConfig] = useState<WhatsappConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<WhatsappTestResult | null>(null);
  const [form, setForm] = useState({
    phoneNumber: '',
    phoneNumberId: '',
    accessToken: '',
    webhookSecret: '',
  });

  const loadQr = useCallback(async () => {
    try {
      const result = await whatsappApi.getQr();

      // Se a sessão do servidor caiu (deploy/restart), o QR exibido não vale mais.
      setQr((current) => {
        if (current?.qr && result.status === 'IDLE') {
          setNotice('A sessão do servidor reiniciou. Gere um novo QR Code para continuar.');
        }
        return result;
      });
    } catch {
      // Silencia falhas de polling
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const result = await whatsappApi.getConfig();
      setConfig(result);
      setForm({
        phoneNumber: result.phoneNumber ?? '',
        phoneNumberId: result.phoneNumberId ?? '',
        accessToken: '',
        webhookSecret: result.webhookSecret ?? '',
      });
    } catch {
      // Silencia falhas de carregamento
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadQr(), loadConfig()]).finally(() => setLoading(false));
  }, [loadQr, loadConfig]);

  // Atualiza o QR enquanto o usuário estiver escaneando
  useEffect(() => {
    if (tab !== 'qr') return;
    if (!qr || (qr.status !== 'AWAITING_SCAN' && qr.status !== 'CONNECTING')) return;

    const timer = window.setInterval(() => void loadQr(), 3000);
    return () => window.clearInterval(timer);
  }, [tab, qr, loadQr]);

  async function handleStartQr() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await whatsappApi.startQr();
      setQr(result);
      setNotice(
        result.qr
          ? 'QR Code gerado. Escaneie com o seu celular.'
          : 'Preparando o QR Code... ele aparece em alguns segundos.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o QR Code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshQr() {
    setBusy(true);
    setError(null);
    try {
      const result = await whatsappApi.refreshQr();
      setQr(result);
      setNotice('Novo QR Code gerado. Escaneie com o seu celular.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível renovar o QR Code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnectQr() {
    if (!window.confirm('Desconectar o WhatsApp deste celular?')) return;

    setBusy(true);
    setError(null);
    try {
      setQr(await whatsappApi.disconnectQr());
      setNotice('WhatsApp desconectado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível desconectar o WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMetaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function handleMetaTest() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      setTestResult(await whatsappApi.testConnection());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível testar a conexão.');
    } finally {
      setBusy(false);
    }
  }

  const qrConnected = qr?.status === 'CONNECTED';
  const metaConnected = config?.connected ?? false;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Atendimento"
        title="Conectar WhatsApp"
        description="Conecte o seu número em 2 minutos: leia o QR Code com o celular e comece a receber mensagens."
        actions={
          qrConnected ? (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => void handleDisconnectQr()}
              disabled={busy}
            >
              Desconectar
            </button>
          ) : undefined
        }
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <div className="tabs" role="tablist" aria-label="Forma de conexão">
        <button
          className={`tabs__tab ${tab === 'qr' ? 'tabs__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'qr'}
          onClick={() => setTab('qr')}
        >
          QR Code (recomendado)
        </button>
        <button
          className={`tabs__tab ${tab === 'meta' ? 'tabs__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'meta'}
          onClick={() => setTab('meta')}
        >
          Meta Cloud API
        </button>
      </div>

      {loading ? (
        <Panel title="WhatsApp">
          <p className="table-loading">Carregando configuração...</p>
        </Panel>
      ) : tab === 'qr' ? (
        <>
          <Panel
            title="Conectar pelo QR Code"
            description="Não precisa de conta Meta Business, token ou configuração de webhook."
            actions={
              <Badge tone={qrConnected ? 'success' : qr?.status === 'AWAITING_SCAN' ? 'warning' : 'neutral'}>
                {STATUS_LABELS[qr?.status ?? 'IDLE']}
              </Badge>
            }
          >
            <div className="qr-connect">
              <div className="qr-connect__code">
                {qr?.qr ? (
                  <>
                    <QrCanvas value={qr.qr} />
                    <p className="qr-connect__hint">
                      {qr.status === 'AWAITING_SCAN'
                        ? 'Abra o WhatsApp no celular → Aparelhos conectados → Conectar com número de telefone → Ler QR Code.'
                        : 'Preparando o QR Code...'}
                    </p>
                  </>
                ) : qrConnected ? (
                  <div className="qr-connect__done">
                    <span className="qr-connect__check" aria-hidden="true">
                      ✓
                    </span>
                    <strong>WhatsApp conectado</strong>
                    <span>
                      Número: {qr.phoneNumber ?? '—'} — as mensagens já chegam em Conversas.
                    </span>
                  </div>
                ) : qr?.status === 'CONNECTING' ? (
                  <div className="qr-connect__done">
                    <span className="qr-connect__check" aria-hidden="true">
                      …
                    </span>
                    <strong>Preparando a conexão</strong>
                    <span>O QR Code aparece em alguns segundos. Não feche esta tela.</span>
                  </div>
                ) : (
                  <EmptyState
                    title="Nenhum QR Code ativo"
                    description="Clique em “Gerar QR Code” para conectar o seu WhatsApp."
                  />
                )}
              </div>

              <div className="qr-connect__actions">
                {qrConnected ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void handleDisconnectQr()}
                    disabled={busy}
                  >
                    Desconectar
                  </button>
                ) : (
                  <>
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void handleStartQr()}
                      disabled={busy}
                    >
                      {busy ? 'Gerando...' : 'Gerar QR Code'}
                    </button>
                    {(qr?.qr || qr?.error) && (
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => void handleRefreshQr()}
                        disabled={busy}
                      >
                        Gerar novo QR Code
                      </button>
                    )}
                  </>
                )}

                {qr?.pairingCode && (
                  <p className="qr-connect__code-alternative">
                    Não consegue ler? Use o código de pareamento:{' '}
                    <strong>{qr.pairingCode}</strong>
                  </p>
                )}

                {qr?.error && (
                  <Feedback tone="error">
                    {qr.error} Se o problema continuar, clique em “Gerar novo QR Code”.
                  </Feedback>
                )}

                {qr?.storage === 'unavailable' && (
                  <Feedback tone="warning">
                    A sessão não está sendo salva no servidor. Depois de um reinício será
                    necessário escanear o QR Code novamente.
                    {qr.storageError ? ` (${qr.storageError})` : ''}
                  </Feedback>
                )}
              </div>
            </div>

            <ol className="step-list">
              <li>
                No celular, abra o <strong>WhatsApp</strong> e toque em{' '}
                <strong>Aparelhos conectados</strong>.
              </li>
              <li>
                Toque em <strong>Conectar com número de telefone</strong> e escolha{' '}
                <strong>Conectar com QR Code</strong>.
              </li>
              <li>
                Aponte a câmera do celular para o QR Code acima. O número aparece como
                conectado em poucos segundos.
              </li>
              <li>
                A sessão fica salva: não será preciso escanear de novo a cada deploy.
              </li>
            </ol>
          </Panel>

          <Panel title="Como funciona por dentro">
            <p className="panel__description">
              O servidor mantém a sessão do seu WhatsApp Web conectada e encaminha as mensagens
              recebidas para a tela de Conversas, criando o cliente automaticamente quando o
              número ainda não está na carteira.
            </p>
          </Panel>
        </>
      ) : (
        <>
          <Panel
            title="Status da conexão (Meta Cloud API)"
            description={metaConnected ? 'WhatsApp conectado via Meta.' : 'WhatsApp não conectado via Meta.'}
            actions={
              <Badge tone={metaConnected ? 'success' : 'warning'}>
                {metaConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            }
          >
            {metaConnected && config ? (
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
                  <dt>Access token</dt>
                  <dd>{config.accessTokenHint ?? '—'}</dd>
                </div>
                <div>
                  <dt>Atualizado em</dt>
                  <dd>{config.updatedAt ? new Date(config.updatedAt).toLocaleString('pt-BR') : '—'}</dd>
                </div>
              </dl>
            ) : (
              <EmptyState
                title="Nenhum número conectado via Meta"
                description="Use o QR Code para conectar sem burocracia, ou preencha os dados abaixo."
              />
            )}
          </Panel>

          <Panel
            title="Dados da conexão (Meta)"
            description="Token permanent e Phone Number ID vêm do painel da Meta (WhatsApp > API Setup)."
          >
            <form className="form-stack" onSubmit={handleMetaSubmit} noValidate>
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
              </div>

              <div className="form-actions-row">
                <button className="button button--primary" type="submit" disabled={busy}>
                  {busy ? 'Salvando...' : metaConnected ? 'Atualizar conexão' : 'Conectar via Meta'}
                </button>
                {metaConnected && (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void handleMetaTest()}
                    disabled={busy}
                  >
                    {busy ? 'Testando...' : 'Testar conexão'}
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
          </Panel>
        </>
      )}
    </AppShell>
  );
}

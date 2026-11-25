import { useState, type FormEvent } from 'react';
import { importsApi } from '../api/resources';
import { AppShell } from '../components/AppShell';
import { Feedback, PageHeader, Panel } from '../components/ui';

interface PreviewResult {
  columns: string[];
  rows: Array<Record<string, string>>;
  summary: { total: number; valid: number; invalid: number };
}

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo CSV ou XLSX.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setPreview(await importsApi.preview(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a prévia.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const result = await importsApi.commit(file, {
        skipInvalid,
        updateExistingCustomers: updateExisting,
      });
      setNotice(
        `Importação concluída: ${result.importedCustomers} cliente(s) e ${result.importedSales} venda(s) importadas.`,
      );
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a importação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Carteira"
        title="Importar dados"
        description="Traga sua base de clientes e vendas de uma planilha CSV ou XLSX."
      />

      {error && <Feedback tone="error">{error}</Feedback>}
      {notice && <Feedback tone="success">{notice}</Feedback>}

      <Panel
        title="Selecionar arquivo"
        description="Colunas aceitas: nome, telefone, cidade, data e valor."
      >
        <form className="form-stack" onSubmit={handlePreview}>
          <div className="field-group">
            <label htmlFor="import-file">Arquivo (CSV ou XLSX)</label>
            <div className="input-wrap">
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </div>
          </div>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={skipInvalid}
              onChange={(event) => setSkipInvalid(event.target.checked)}
            />
            <span>Ignorar linhas inválidas</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            <span>Atualizar clientes que já existem</span>
          </label>

          <div>
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? 'Processando...' : 'Gerar prévia'}
            </button>
          </div>
        </form>
      </Panel>

      {preview && (
        <Panel
          title="Prévia da importação"
          description={`${preview.summary.valid} linha(s) válida(s) · ${preview.summary.invalid} inválida(s)`}
          actions={
            <button
              className="button button--primary"
              type="button"
              onClick={() => void handleCommit()}
              disabled={busy}
            >
              {busy ? 'Importando...' : 'Confirmar importação'}
            </button>
          }
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {preview.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row, index) => (
                  <tr key={index}>
                    {preview.columns.map((column) => (
                      <td key={column}>{row[column] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 20 && (
            <p className="table-cell__meta">
              Exibindo as 20 primeiras linhas de {preview.rows.length}.
            </p>
          )}
        </Panel>
      )}
    </AppShell>
  );
}

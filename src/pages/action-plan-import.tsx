import { CircleAlert, FileSpreadsheet, Upload } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';

import { ACTION_STATUS_LABEL, importPlanSheet, PRIORITY_LABEL, type SheetImport } from '../api/action-plan';
import { ApiError } from '../api/client';
import { useToast } from '../components/toast';
import { Drawer } from '../components/ui';
import './benefits-agenda.css';
import { plural } from '../lib/plural';

function shortDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

/**
 * Importar a planilha do plano de acao (modelo NR-01 da Turi, .xlsx ou .csv).
 * Primeiro mostra a previa (o que entra, avisos e linhas de fora); so cria as acoes ao confirmar.
 */
export function ActionPlanImport({ token, companyId, open, onClose, onImported }: { token: string; companyId: string; open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SheetImport | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null); setPreview(null);
    if (input.current) input.current.value = '';
  }
  function close() {
    if (busy) return;
    reset(); onClose();
  }

  async function check(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    try { setPreview(await importPlanSheet(token, companyId, file, true)); }
    catch (reason) { toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível ler a planilha.'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await importPlanSheet(token, companyId, file, false);
      toast.success(`${plural(result.created, 'ação importada', 'ações importadas')}.`);
      onImported(); reset(); onClose();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível importar.');
    } finally {
      setBusy(false);
    }
  }

  const skipped = preview ? preview.rows.filter((row) => row.skipped).length : 0;

  return (
    <Drawer open={open} onClose={close} title="Importar planilha do plano de ação" size="lg"
      description="Use o modelo da Turi (.xlsx ou .csv). As colunas são reconhecidas pelo nome; a data limite vira a data da ação na agenda."
      footer={preview ? (
        <>
          <button type="button" className="secondary-button" onClick={reset} disabled={busy}>Escolher outra</button>
          <button type="button" className="primary-button" onClick={() => void confirm()} disabled={busy || !preview.to_create}><Upload size={15} />Importar {plural(preview.to_create, 'ação', 'ações')}</button>
        </>
      ) : undefined}>
      {!preview ? (
        <form className="admin-form" onSubmit={(event) => void check(event)}>
          <label><span>Planilha</span><input ref={input} type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>
          <p className="ben-hint">Nada é salvo nesta etapa: primeiro você confere o que a plataforma entendeu de cada linha. Ações que já existem no plano (mesma medida mitigadora) ficam de fora.</p>
          <button className="primary-button" disabled={!file || busy}><FileSpreadsheet size={15} />{busy ? 'Lendo…' : 'Conferir planilha'}</button>
        </form>
      ) : (
        <div className="api-preview">
          <p className="api-summary">
            <strong>{preview.to_create}</strong> ação(ões) para importar{skipped ? <> · <strong>{skipped}</strong> linha(s) de fora</> : null}.
          </p>
          <div className="api-table-wrap">
            <table className="api-table">
              <thead><tr><th>Linha</th><th>Medida mitigadora</th><th>Prioridade</th><th>Situação</th><th>Data limite</th><th>Avisos</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line} className={row.skipped ? 'is-skipped' : ''}>
                    <td>{row.line}</td>
                    <td>{row.title ?? <em>sem medida</em>}{row.risk_factor ? <span className="ben-hint">{row.risk_factor}</span> : null}</td>
                    <td>{row.priority ? PRIORITY_LABEL[row.priority] : '—'}</td>
                    <td>{ACTION_STATUS_LABEL[row.status ?? 'pending']}</td>
                    <td>{shortDate(row.due_at)}</td>
                    <td>{[...row.errors, ...row.warnings].length ? (
                      <ul className="api-warnings">{[...row.errors, ...row.warnings].map((text) => <li key={text}><CircleAlert size={12} aria-hidden />{text}</li>)}</ul>
                    ) : 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}

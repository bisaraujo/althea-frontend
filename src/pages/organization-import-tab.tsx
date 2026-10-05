import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import {
  IMPORT_COLUMNS, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, type ImportRow,
  apiErrorMessage, formatBytes, importTemplateCsv, mapImportRows, parseCsv,
} from '../api/organization';
import { commitOrganizationalImport, createOrganizationalImport } from '../api/services';
import type { OrganizationalImport } from '../api/types';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { DataTable, LoadingState } from '../components/ui';

type PreviewRow = { row_number: number; valid: boolean; errors: string[] } & Partial<Record<'name' | 'email' | 'unit' | 'area' | 'position' | 'started_at', string | null>>;

const ERROR_TEXT: Record<string, string> = {
  'nome obrigatorio': 'Nome é obrigatório',
  'nome longo demais': 'Nome muito longo',
  'e-mail invalido': 'E-mail inválido',
  'e-mail ja cadastrado na empresa': 'E-mail já cadastrado na empresa',
  'duplicado no lote': 'Repetido no arquivo (mesmo e-mail ou nome)',
  'data de inicio invalida (use AAAA-MM-DD ou DD/MM/AAAA)': 'Data de início inválida (use AAAA-MM-DD ou DD/MM/AAAA)',
};
const errorText = (value: string) => ERROR_TEXT[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
function isoToBr(value: string | null | undefined) { if (!value) return '—'; const [year, month, day] = value.slice(0, 10).split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }

async function readText(file: File) {
  const buffer = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('windows-1252').decode(buffer); } // CSV salvo pelo Excel em português
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([importTemplateCsv()], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'modelo-importacao-colaboradores.csv';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = { token: string; companyId: string; onImported: () => Promise<void> };

export function ImportTab({ token, companyId, onImported }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState<'reading' | 'committing' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [batch, setBatch] = useState<OrganizationalImport | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [ignored, setIgnored] = useState<string[]>([]);

  function reset() { setBatch(null); setProblem(null); setFileName(''); setIgnored([]); setOnlyErrors(false); if (input.current) input.current.value = ''; }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProblem(null); setBatch(null); setIgnored([]); setFileName(file.name);
    if (!/\.(csv|txt)$/i.test(file.name)) { setProblem('Envie um arquivo CSV. Se a planilha está no Excel, use “Salvar como” e escolha CSV.'); return; }
    if (file.size === 0) { setProblem('O arquivo está vazio.'); return; }
    if (file.size > IMPORT_MAX_BYTES) { setProblem(`O arquivo passa do limite de ${formatBytes(IMPORT_MAX_BYTES)}.`); return; }
    setBusy('reading');
    try {
      const parsed = mapImportRows(parseCsv(await readText(file)));
      if (parsed.missingColumns.length) { setProblem(`Não encontramos a coluna “${parsed.missingColumns.join('”, “')}” na primeira linha. Use o modelo para conferir os nomes das colunas.`); return; }
      if (!parsed.rows.length) { setProblem('O arquivo tem só o cabeçalho. Adicione ao menos uma linha de colaborador.'); return; }
      if (parsed.rows.length > IMPORT_MAX_ROWS) { setProblem(`O arquivo tem ${parsed.rows.length} linhas. Envie até ${IMPORT_MAX_ROWS} por vez.`); return; }
      setIgnored(parsed.ignoredColumns);
      const result = await createOrganizationalImport(token, companyId, { file_name: file.name, rows: parsed.rows as ImportRow[] });
      setBatch(result); setOnlyErrors(result.summary.invalid > 0);
    } catch (reason) { setProblem(apiErrorMessage(reason)); }
    finally { setBusy(null); }
  }

  async function commit() {
    if (!batch || busy) return;
    setBusy('committing');
    try {
      const done = await commitOrganizationalImport(token, batch.id);
      setBatch(done); toast.success(`${done.summary.created || 0} colaborador(es) importado(s).`);
      await onImported().catch(() => undefined);
    } catch (reason) { toast.error(apiErrorMessage(reason)); }
    finally { setBusy(null); }
  }

  const rows = useMemo(() => (batch?.rows ?? []) as unknown as PreviewRow[], [batch]);
  const invalid = batch?.summary.invalid ?? 0;
  const committed = batch?.status === 'committed';
  const shown = (onlyErrors ? rows.filter((row) => !row.valid) : rows).slice(0, 200);
  const canCommit = batch?.status === 'validated' && !busy;

  return (
    <div className="org-import">
      <SectionPanel title="1. Baixe o modelo" eyebrow="Planilha CSV">
        <p className="panel-intro">Preencha uma linha por colaborador. Só o nome é obrigatório.
          <InfoTooltip text="Cada Área é criada dentro da Unidade da mesma linha, e cada Cargo dentro da Área. Assim, “RH” da Matriz e “RH” da Filial são áreas diferentes. Unidades, áreas e cargos que ainda não existem são criados na importação." label="Como a importação monta a hierarquia" />
        </p>
        <ul className="org-import-columns">
          {IMPORT_COLUMNS.map((column) => <li key={column.key} className={column.key === 'name' ? 'is-required' : undefined}>{column.header}{column.key === 'name' ? ' *' : ''}</li>)}
        </ul>
        <p className="org-hint">Data de início: AAAA-MM-DD ou DD/MM/AAAA. Colaboradores com e-mail já cadastrado na empresa aparecem como erro.</p>
        <button type="button" className="secondary-button" onClick={downloadTemplate}><Download size={16} />Baixar modelo (CSV)</button>
      </SectionPanel>

      <SectionPanel title="2. Envie o arquivo" eyebrow="Validação antes de importar">
        <div className="org-dropzone">
          <input ref={input} type="file" accept=".csv,.txt,text/csv" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
          <FileSpreadsheet size={26} aria-hidden />
          <div>
            <strong>{fileName || 'Nenhum arquivo escolhido'}</strong>
            <span className="org-hint">CSV com separador ; , ou tab · até {IMPORT_MAX_ROWS} linhas · {formatBytes(IMPORT_MAX_BYTES)}</span>
          </div>
          <button type="button" className="primary-button" disabled={busy !== null} onClick={() => input.current?.click()}><Upload size={16} />{fileName ? 'Escolher outro' : 'Escolher arquivo'}</button>
        </div>
        {busy === 'reading' ? <LoadingState variant="inline" label="Lendo e validando o arquivo…" /> : null}
        {problem ? <p className="org-field-error" role="alert">{problem}</p> : null}
        {ignored.length ? <p className="org-hint">Colunas ignoradas: {ignored.join(', ')}.</p> : null}
      </SectionPanel>

      {batch ? (
        <SectionPanel title="3. Confira e confirme" eyebrow={committed ? 'Concluído' : `${batch.summary.total} linha(s)`}>
          {committed ? (
            <div className="org-import-done" role="status">
              <CheckCircle2 size={22} aria-hidden />
              <div><strong>{batch.summary.created || 0} colaborador(es) importado(s)</strong><span className="org-hint">Unidades, áreas e cargos novos já estão na aba Estrutura.</span></div>
              <button type="button" className="secondary-button" onClick={reset}><RotateCcw size={15} />Importar outro arquivo</button>
            </div>
          ) : (
            <>
              <div className="org-import-summary">
                <StatusPill tone="muted">{`${batch.summary.total} linha(s)`}</StatusPill>
                <StatusPill tone="success">{`${batch.summary.valid} válida(s)`}</StatusPill>
                {invalid ? <StatusPill tone="warning">{`${invalid} com erro`}</StatusPill> : null}
                {invalid ? <label className="org-check"><input type="checkbox" checked={onlyErrors} onChange={(event) => setOnlyErrors(event.target.checked)} />Mostrar só as linhas com erro</label> : null}
              </div>
              {invalid ? <p className="org-import-alert" role="status">Corrija as linhas com erro no arquivo e envie de novo. Nada é importado enquanto houver erro.</p> : null}
              <DataTable<PreviewRow>
                dense caption="Prévia da importação" rows={shown} rowKey={(row) => String(row.row_number)}
                columns={[
                  { key: 'line', header: 'Linha', width: '64px', render: (row) => row.row_number },
                  { key: 'name', header: 'Nome', render: (row) => row.name || '—' },
                  { key: 'email', header: 'E-mail', hideOnMobile: true, render: (row) => row.email || '—' },
                  { key: 'unit', header: 'Unidade', hideOnMobile: true, render: (row) => row.unit || '—' },
                  { key: 'area', header: 'Área', hideOnMobile: true, render: (row) => row.area || '—' },
                  { key: 'position', header: 'Cargo', hideOnMobile: true, render: (row) => row.position || '—' },
                  { key: 'started', header: 'Início', hideOnMobile: true, render: (row) => isoToBr(row.started_at) },
                  { key: 'status', header: 'Situação', render: (row) => row.valid ? <StatusPill tone="success">OK</StatusPill> : <span className="org-row-errors">{row.errors.map(errorText).join('; ')}</span> },
                ]}
              />
              {rows.length > 200 || (onlyErrors && shown.length < rows.filter((row) => !row.valid).length) ? <p className="org-hint">Mostrando as primeiras 200 linhas da prévia.</p> : null}
              <div className="org-import-actions">
                <button type="button" className="secondary-button" onClick={reset} disabled={busy !== null}>Cancelar</button>
                <button type="button" className="primary-button" onClick={() => void commit()} disabled={!canCommit}>{busy === 'committing' ? 'Importando…' : `Importar ${batch.summary.valid} colaborador(es)`}</button>
              </div>
            </>
          )}
        </SectionPanel>
      ) : null}
    </div>
  );
}

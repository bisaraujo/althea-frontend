import { ExternalLink, FileText, History, Link2, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import {
  DOCUMENT_EXTENSIONS, DOCUMENT_MAX_BYTES, type DocumentOrigin, type OrgDocument, type OrgDocumentVersion,
  addLinkVersion, apiErrorMessage, createLinkDocument, deleteDocument, formatBytes,
  getDocumentVersions, getDocuments, openDocument, uploadDocument, uploadDocumentVersion, validateDocumentFile,
} from '../api/organization';
import { EmptyState } from '../components/empty-state';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';
import { DataTable, Drawer, ErrorState, FilterBar, LoadingState, Modal, NoPermissionState, SearchInput, SegmentedFilter, useConfirm } from '../components/ui';

const DOCUMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'policy', label: 'Política' }, { value: 'manual', label: 'Manual' }, { value: 'procedure', label: 'Procedimento' },
  { value: 'contract', label: 'Contrato' }, { value: 'form', label: 'Formulário' }, { value: 'other', label: 'Outro' },
];
const typeLabel = (value: string) => DOCUMENT_TYPES.find((item) => item.value === value)?.label ?? value;
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function OriginPill({ origin }: { origin: DocumentOrigin }) { return origin === 'file' ? <span className="org-origin org-origin--file"><Paperclip size={12} aria-hidden />Arquivo</span> : <span className="org-origin"><Link2 size={12} aria-hidden />Link</span>; }
function nameFromUrl(url: string) { try { const last = new URL(url).pathname.split('/').filter(Boolean).pop(); return last ? decodeURIComponent(last) : new URL(url).hostname; } catch { return url; } }

/** Escolha entre enviar arquivo e informar link; usado ao criar documento e ao adicionar versão. */
type SourceValue = { mode: 'file' | 'link'; file: File | null; url: string };
function SourceFields({ value, onChange, disabled, error }: { value: SourceValue; onChange: (next: SourceValue) => void; disabled: boolean; error: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="org-source">
      <div className="ui-segmented" role="group" aria-label="Origem do documento">
        <button type="button" className={value.mode === 'file' ? 'is-active' : undefined} aria-pressed={value.mode === 'file'} disabled={disabled} onClick={() => onChange({ ...value, mode: 'file' })}><Upload size={13} aria-hidden /> Enviar arquivo</button>
        <button type="button" className={value.mode === 'link' ? 'is-active' : undefined} aria-pressed={value.mode === 'link'} disabled={disabled} onClick={() => onChange({ ...value, mode: 'link' })}><Link2 size={13} aria-hidden /> Link externo</button>
      </div>
      {value.mode === 'file' ? (
        <div className="org-file-pick">
          <input ref={input} type="file" hidden accept={DOCUMENT_EXTENSIONS.map((item) => `.${item}`).join(',')} onChange={(event) => onChange({ ...value, file: event.target.files?.[0] ?? null })} />
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => input.current?.click()}><Paperclip size={15} />{value.file ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
          <span className="org-hint">{value.file ? `${value.file.name} · ${formatBytes(value.file.size)}` : `Até ${DOCUMENT_MAX_BYTES / 1024 / 1024} MB · ${DOCUMENT_EXTENSIONS.join(', ')}`}</span>
        </div>
      ) : (
        <label><span>Endereço do link</span><input type="url" inputMode="url" placeholder="https://" value={value.url} disabled={disabled} onChange={(event) => onChange({ ...value, url: event.target.value })} /></label>
      )}
      {error ? <p className="org-field-error" role="alert">{error}</p> : null}
    </div>
  );
}

function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="org-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Envio do arquivo">
      <span style={{ width: `${percent}%` }} />
      <em>{percent < 100 ? `Enviando… ${percent}%` : 'Processando…'}</em>
    </div>
  );
}

function sourceError(source: SourceValue): string | null {
  if (source.mode === 'file') return source.file ? validateDocumentFile(source.file) : null;
  const url = source.url.trim();
  return url && !/^https?:\/\/\S+$/i.test(url) ? 'Use um endereço que comece com http:// ou https://.' : null;
}
const sourceReady = (source: SourceValue) => (source.mode === 'file' ? Boolean(source.file) : Boolean(source.url.trim())) && !sourceError(source);
const emptySource: SourceValue = { mode: 'file', file: null, url: '' };

function NewDocumentModal({ token, companyId, onClose, onCreated }: { token: string; companyId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('policy');
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [linkName, setLinkName] = useState('');
  const [percent, setPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const error = sourceError(source);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !title.trim() || !sourceReady(source)) return;
    setSaving(true); setPercent(source.mode === 'file' ? 0 : null);
    try {
      if (source.mode === 'file' && source.file) await uploadDocument(token, companyId, { title: title.trim(), document_type: type, file: source.file }, setPercent);
      else await createLinkDocument(token, companyId, { title: title.trim(), document_type: type, file_name: linkName.trim() || nameFromUrl(source.url.trim()), file_url: source.url.trim() });
      toast.success('Documento registrado.');
      onCreated(); onClose();
    } catch (reason) { toast.error(apiErrorMessage(reason)); setSaving(false); setPercent(null); }
  }

  return (
    <Modal open onClose={saving ? () => undefined : onClose} title="Novo documento" description="Envie um arquivo ou registre um link. Novas versões ficam guardadas no histórico." size="md"
      footer={<><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="org-doc-form" className="primary-button" disabled={saving || !title.trim() || !sourceReady(source)}>{saving ? 'Enviando…' : 'Registrar documento'}</button></>}>
      <form id="org-doc-form" className="admin-form" onSubmit={(event) => void submit(event)}>
        <label><span>Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} disabled={saving} autoFocus required /></label>
        <label><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value)} disabled={saving}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <SourceFields value={source} onChange={setSource} disabled={saving} error={error} />
        {source.mode === 'link' ? <label><span>Nome de exibição <em className="org-optional">(opcional)</em></span><input value={linkName} onChange={(event) => setLinkName(event.target.value)} maxLength={200} disabled={saving} placeholder="Ex.: Manual de conduta (versão online)" /></label> : null}
        {percent !== null ? <UploadProgress percent={percent} /> : null}
      </form>
    </Modal>
  );
}

function VersionsDrawer({ token, doc, onClose, onChanged }: { token: string; doc: OrgDocument; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [versions, setVersions] = useState<OrgDocumentVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [notes, setNotes] = useState('');
  const [percent, setPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const error = sourceError(source);
  const open = (target: Parameters<typeof openDocument>[1]) => openDocument(token, target).catch((reason) => toast.error(apiErrorMessage(reason)));

  const load = useCallback(() => {
    setFailed(false);
    getDocumentVersions(token, doc.id).then(setVersions).catch(() => setFailed(true));
  }, [token, doc.id]);
  useEffect(() => { load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !sourceReady(source)) return;
    setSaving(true); setPercent(source.mode === 'file' ? 0 : null);
    try {
      if (source.mode === 'file' && source.file) await uploadDocumentVersion(token, doc.id, { file: source.file, notes: notes.trim() || undefined }, setPercent);
      else await addLinkVersion(token, doc.id, { file_name: nameFromUrl(source.url.trim()), file_url: source.url.trim(), notes: notes.trim() || null });
      toast.success('Nova versão registrada.');
      setSource(emptySource); setNotes(''); load(); onChanged();
    } catch (reason) { toast.error(apiErrorMessage(reason)); }
    finally { setSaving(false); setPercent(null); }
  }

  return (
    <Drawer open onClose={saving ? () => undefined : onClose} title={doc.title} description={`${typeLabel(doc.document_type)} · versão atual ${doc.current_version}`}>
      <form className="org-drawer-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving}>
          <legend>Enviar nova versão</legend>
          <SourceFields value={source} onChange={setSource} disabled={saving} error={error} />
          <label><span>O que mudou <em className="org-optional">(opcional)</em></span><input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Ex.: revisão de 2026" /></label>
          {percent !== null ? <UploadProgress percent={percent} /> : null}
          <button type="submit" className="primary-button" disabled={saving || !sourceReady(source)}>{saving ? 'Enviando…' : 'Registrar versão'}</button>
        </fieldset>
      </form>
      <h3 className="org-subtitle">Histórico de versões</h3>
      {failed ? <ErrorState message="Não foi possível carregar o histórico." onRetry={load} /> : null}
      {!failed && versions === null ? <LoadingState /> : null}
      {versions ? (
        <ol className="org-versions">
          {versions.map((item) => (
            <li key={item.id}>
              <span className="org-versions__badge">v{item.version}</span>
              <div className="org-versions__copy">
                <strong>{item.file_name}</strong>
                <span className="org-hint">{formatDateTime(item.created_at)}{item.created_by_name ? ` · ${item.created_by_name}` : ''}{item.notes && item.notes !== 'Versao inicial' ? ` · ${item.notes}` : item.notes === 'Versao inicial' ? ' · versão inicial' : ''}</span>
              </div>
              <OriginPill origin={item.origin} />
              <button type="button" className="secondary-button org-open-btn" onClick={() => void open({ documentId: doc.id, versionId: item.id, origin: item.origin, fileUrl: item.file_url, fileName: item.file_name })}><ExternalLink size={14} aria-hidden />Abrir</button>
            </li>
          ))}
        </ol>
      ) : null}
    </Drawer>
  );
}

export function DocumentsTab({ token, companyId }: { token: string; companyId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [documents, setDocuments] = useState<OrgDocument[] | null>(null);
  const [error, setError] = useState<{ forbidden: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState<'all' | DocumentOrigin>('all');
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<OrgDocument | null>(null);
  const seq = useRef(0);
  const open = (target: Parameters<typeof openDocument>[1]) => openDocument(token, target).catch((reason) => toast.error(apiErrorMessage(reason)));

  const load = useCallback(() => {
    const current = ++seq.current;
    setError(null);
    getDocuments(token, companyId)
      .then((data) => { if (current === seq.current) setDocuments(data); })
      .catch((reason) => { if (current === seq.current) setError({ forbidden: reason instanceof ApiError && reason.status === 403 }); });
  }, [token, companyId]);
  useEffect(() => { setDocuments(null); load(); }, [load]);

  const counts = useMemo(() => ({ all: documents?.length ?? 0, file: documents?.filter((item) => item.origin === 'file').length ?? 0, link: documents?.filter((item) => item.origin === 'link').length ?? 0 }), [documents]);
  const needle = query.trim().toLowerCase();
  const visible = (documents ?? []).filter((item) => (origin === 'all' || item.origin === origin) && (!needle || [item.title, item.file_name, typeLabel(item.document_type)].some((value) => value.toLowerCase().includes(needle))));

  async function remove(item: OrgDocument) {
    const ok = await confirm({ title: `Remover “${item.title}”?`, description: `O documento e as ${item.current_version} versão(ões) do histórico serão removidos${item.origin === 'file' ? ', inclusive os arquivos enviados' : ''}. A remoção fica registrada na auditoria e não pode ser desfeita.`, confirmLabel: 'Remover documento', tone: 'danger' });
    if (!ok) return;
    try { await deleteDocument(token, item.id); toast.success('Documento removido.'); load(); }
    catch (reason) { toast.error(apiErrorMessage(reason)); }
  }

  if (error?.forbidden) return <NoPermissionState message="Você não tem permissão para ver os documentos desta empresa." />;
  if (error) return <ErrorState message="Não foi possível carregar os documentos." onRetry={load} />;

  return (
    <div className="org-documents">
      <FilterBar actions={<button type="button" className="primary-button" onClick={() => setCreating(true)}><Plus size={16} />Novo documento</button>}>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por título, arquivo ou tipo" label="Buscar documento" />
        <SegmentedFilter<'all' | DocumentOrigin> label="Origem" value={origin} onChange={setOrigin} options={[{ value: 'all', label: 'Todos', count: counts.all }, { value: 'file', label: 'Arquivos', count: counts.file }, { value: 'link', label: 'Links', count: counts.link }]} />
      </FilterBar>
      <DataTable<OrgDocument>
        caption="Documentos da empresa"
        rows={visible}
        rowKey={(item) => item.id}
        loading={documents === null}
        empty={documents?.length ? <EmptyState icon={FileText} title="Nenhum documento encontrado" description="Ajuste a busca ou o filtro de origem." /> : <div className="org-empty-action"><EmptyState icon={FileText} title="Nenhum documento ainda" description="Guarde políticas, manuais e contratos da empresa. Envie o arquivo ou registre um link, com histórico de versões." /><button type="button" className="primary-button" onClick={() => setCreating(true)}><Plus size={16} />Novo documento</button></div>}
        columns={[
          { key: 'title', header: 'Documento', render: (item) => <span className="org-doc-cell"><FileText size={18} aria-hidden /><span className="org-person__copy"><strong>{item.title}</strong><span className="org-person__email">{item.file_name}</span></span></span> },
          { key: 'type', header: 'Tipo', hideOnMobile: true, render: (item) => typeLabel(item.document_type) },
          { key: 'origin', header: 'Origem', width: '110px', render: (item) => <OriginPill origin={item.origin} /> },
          { key: 'version', header: 'Versão', width: '80px', hideOnMobile: true, render: (item) => <StatusPill tone="muted">{`v${item.current_version}`}</StatusPill> },
          { key: 'date', header: 'Atualizado', width: '110px', hideOnMobile: true, render: (item) => formatDateTime(item.updated_at) },
          { key: 'actions', header: 'Ações', width: '140px', align: 'right', render: (item) => (
            <span className="org-row-actions">
              <button type="button" className="org-icon-btn" aria-label={`Abrir ${item.title}`} title="Abrir / baixar" onClick={() => void open({ documentId: item.id, origin: item.origin, fileUrl: item.file_url, fileName: item.file_name })}><ExternalLink size={14} aria-hidden /></button>
              <button type="button" className="org-icon-btn" aria-label={`Versões de ${item.title}`} title="Versões" onClick={() => setHistory(item)}><History size={14} aria-hidden /></button>
              <button type="button" className="org-icon-btn org-icon-btn--danger" aria-label={`Remover ${item.title}`} title="Remover" onClick={() => void remove(item)}><Trash2 size={14} aria-hidden /></button>
            </span>
          ) },
        ]}
      />
      {creating ? <NewDocumentModal token={token} companyId={companyId} onClose={() => setCreating(false)} onCreated={load} /> : null}
      {history ? <VersionsDrawer token={token} doc={documents?.find((item) => item.id === history.id) ?? history} onClose={() => setHistory(null)} onChanged={load} /> : null}
    </div>
  );
}

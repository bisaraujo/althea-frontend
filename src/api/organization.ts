import { API_URL, ApiError, request } from './client';
import type { Employment, OrganizationalArea, OrganizationalAuditLog, OrganizationalDocument, OrganizationalPosition, OrganizationalUnit, Person } from './types';

type Method = 'PATCH' | 'POST' | 'DELETE';

function json(method: Method, token: string, payload?: unknown) {
  return { token, method, body: payload === undefined ? undefined : JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } };
}

/** Move uma área para outra unidade (o backend realinha os vínculos que usam a área). */
export function moveOrganizationalArea(token: string, areaId: string, unitId: string) {
  return request<OrganizationalArea>(`/areas/${areaId}`, json('PATCH', token, { unit_id: unitId }));
}

/** Move um cargo para outra área (o backend realinha área e unidade dos vínculos). */
export function moveOrganizationalPosition(token: string, positionId: string, areaId: string) {
  return request<OrganizationalPosition>(`/positions/${positionId}`, json('PATCH', token, { area_id: areaId }));
}

export type StructurePatch = { name?: string; active?: boolean };

export function updateOrganizationalUnit(token: string, id: string, payload: StructurePatch) {
  return request<OrganizationalUnit>(`/organizational-units/${id}`, json('PATCH', token, payload));
}
export function updateOrganizationalArea(token: string, id: string, payload: StructurePatch) {
  return request<OrganizationalArea>(`/areas/${id}`, json('PATCH', token, payload));
}
export function updateOrganizationalPosition(token: string, id: string, payload: StructurePatch) {
  return request<OrganizationalPosition>(`/positions/${id}`, json('PATCH', token, payload));
}

export function updatePerson(token: string, id: string, payload: { name?: string; email?: string | null; phone?: string | null }) {
  return request<Person>(`/people/${id}`, json('PATCH', token, payload));
}

export type EmploymentPatch = { unit_id?: string | null; area_id?: string | null; position_id?: string | null; started_at?: string | null; status?: string; ended_at?: string | null; user_id?: string | null };

export type PlatformUser = { id: string; name: string; email: string; role: 'manager' | 'employee'; linked_employment_id: string | null; linked_person_name: string | null };
export function getPlatformUsers(token: string, companyId: string) {
  return request<PlatformUser[]>(`/companies/${companyId}/platform-users`, { token });
}
export function updateEmployment(token: string, id: string, payload: EmploymentPatch) {
  return request<Employment>(`/employments/${id}`, json('PATCH', token, payload));
}

/** Encerra o vínculo (não apaga o histórico). `endedAt` em AAAA-MM-DD; sem data usa hoje. */
export function endEmployment(token: string, id: string, endedAt?: string | null) {
  return request<Employment>(`/employments/${id}/end`, json('POST', token, endedAt ? { ended_at: endedAt } : {}));
}

/* ---------------------------------------------------------------- Documentos */

export type DocumentOrigin = 'file' | 'link';
export type OrgDocument = OrganizationalDocument & { origin: DocumentOrigin };
export type OrgDocumentVersion = { id: string; document_id: string; version: number; file_name: string; file_url: string; notes: string | null; created_by: string | null; created_by_name: string | null; origin: DocumentOrigin; created_at: string };

export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'txt', 'csv', 'png', 'jpg', 'jpeg'];

/** Valida o arquivo antes de enviar (o backend valida de novo). Retorna a mensagem de erro ou null. */
export function validateDocumentFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!DOCUMENT_EXTENSIONS.includes(extension)) return `Tipo de arquivo não permitido. Envie: ${DOCUMENT_EXTENSIONS.join(', ')}.`;
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > DOCUMENT_MAX_BYTES) return `O arquivo passa do limite de ${DOCUMENT_MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Abre um documento. Link externo abre direto; arquivo da plataforma é privado e só sai
 * por endpoint autenticado (fetch com token -> blob -> download).
 */
export async function openDocument(token: string, target: { documentId: string; versionId?: string; origin: DocumentOrigin; fileUrl: string; fileName: string }) {
  if (target.origin === 'link') {
    window.open(target.fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  const query = target.versionId ? `?version_id=${encodeURIComponent(target.versionId)}` : '';
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organizational-documents/${target.documentId}/download${query}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }
  if (!response.ok) {
    let message = 'Não foi possível baixar o arquivo.';
    try { const data = await response.json(); if (data?.detail) message = String(data.detail); } catch { /* corpo sem JSON */ }
    throw new ApiError(message, response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = target.fileName || 'documento';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function getDocuments(token: string, companyId: string) {
  return request<OrgDocument[]>(`/companies/${companyId}/organizational-documents`, { token });
}
export function getDocumentVersions(token: string, documentId: string) {
  return request<OrgDocumentVersion[]>(`/organizational-documents/${documentId}/versions`, { token });
}
export function createLinkDocument(token: string, companyId: string, payload: { title: string; document_type: string; file_name: string; file_url: string }) {
  return request<OrgDocument>(`/companies/${companyId}/organizational-documents`, json('POST', token, { ...payload, entity_type: 'company' }));
}
export function addLinkVersion(token: string, documentId: string, payload: { file_name: string; file_url: string; notes?: string | null }) {
  return request<OrgDocumentVersion>(`/organizational-documents/${documentId}/versions`, json('POST', token, payload));
}
export function deleteDocument(token: string, documentId: string) {
  return request<string>(`/organizational-documents/${documentId}`, json('DELETE', token));
}

/** Envio multipart com progresso real (XMLHttpRequest, pois fetch não expõe o upload). */
function uploadWithProgress<T>(path: string, token: string, form: FormData, onProgress?: (percent: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      let data: unknown = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { data = null; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(data as T); return; }
      if (xhr.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
      const detail = typeof data === 'object' && data !== null && 'detail' in data ? (data as { detail: unknown }).detail : null;
      reject(new ApiError(typeof detail === 'string' ? detail : 'Não foi possível enviar o arquivo.', xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0));
    xhr.ontimeout = () => reject(new ApiError('O envio demorou demais. Tente novamente.', 0));
    xhr.send(form);
  });
}

export function uploadDocument(token: string, companyId: string, payload: { title: string; document_type: string; file: File }, onProgress?: (percent: number) => void) {
  const form = new FormData();
  form.append('title', payload.title); form.append('document_type', payload.document_type); form.append('file', payload.file);
  return uploadWithProgress<OrgDocument>(`/companies/${companyId}/organizational-documents/upload`, token, form, onProgress);
}
export function uploadDocumentVersion(token: string, documentId: string, payload: { file: File; notes?: string }, onProgress?: (percent: number) => void) {
  const form = new FormData();
  form.append('file', payload.file); if (payload.notes) form.append('notes', payload.notes);
  return uploadWithProgress<OrgDocumentVersion>(`/organizational-documents/${documentId}/versions/upload`, token, form, onProgress);
}

/* ------------------------------------------------------------------ Auditoria */

export type AuditEntry = OrganizationalAuditLog & { actor_name: string | null; resolved: Record<string, string> };
export function getAudit(token: string, companyId: string) {
  return request<AuditEntry[]>(`/companies/${companyId}/organizational-audit`, { token });
}

/** Mensagem legível para qualquer erro de API (o backend já responde em português). */
export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError && error.message ? error.message : 'Não foi possível concluir a operação. Tente novamente.';
}

/* ----------------------------------------------------------------- Importação */

/** Fonte única das colunas: template, leitura do arquivo, prévia e envio usam esta lista. */
export const IMPORT_COLUMNS = [
  { key: 'name', header: 'Nome', aliases: ['nome', 'colaborador', 'name'] },
  { key: 'email', header: 'E-mail', aliases: ['email', 'e-mail', 'e mail'] },
  { key: 'unit', header: 'Unidade', aliases: ['unidade', 'unit'] },
  { key: 'area', header: 'Área', aliases: ['area', 'departamento', 'setor'] },
  { key: 'position', header: 'Cargo', aliases: ['cargo', 'funcao', 'position'] },
  { key: 'started_at', header: 'Data de início', aliases: ['data de inicio', 'data inicio', 'inicio', 'data de admissao', 'admissao', 'started at'] },
] as const;
export type ImportKey = (typeof IMPORT_COLUMNS)[number]['key'];
export type ImportRow = Record<ImportKey, string>;
export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

function normalizeHeader(value: string) {
  return value.replace(/^﻿/, '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

/** Modelo CSV (separador ;, com BOM para o Excel abrir acentos corretamente). */
export function importTemplateCsv() {
  const header = IMPORT_COLUMNS.map((column) => column.header).join(';');
  const example = ['Maria Souza', 'maria@empresa.com', 'Matriz', 'Financeiro', 'Analista Financeiro', '2026-01-15'].join(';');
  return `﻿${header}\n${example}\n`;
}

/** Leitor de CSV com aspas, BOM e detecção de separador (; , ou tab). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', '\t', ','].map((char) => ({ char, count: firstLine.split(char).length })).sort((a, b) => b.count - a.count)[0].char;
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[index + 1] === '\n') index += 1;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((line) => line.some((value) => value.trim()));
}

export type ParsedImport = { rows: ImportRow[]; missingColumns: string[]; ignoredColumns: string[] };

/** Converte as linhas do CSV em ImportRow pelo cabeçalho; devolve as colunas obrigatórias que faltam. */
export function mapImportRows(matrix: string[][]): ParsedImport {
  const [header = [], ...body] = matrix;
  const indexByKey = new Map<ImportKey, number>();
  const ignoredColumns: string[] = [];
  header.forEach((title, index) => {
    const normalized = normalizeHeader(title);
    const column = IMPORT_COLUMNS.find((item) => normalizeHeader(item.header) === normalized || (item.aliases as readonly string[]).includes(normalized));
    if (column && !indexByKey.has(column.key)) indexByKey.set(column.key, index); else if (title.trim()) ignoredColumns.push(title.trim());
  });
  const missingColumns = !indexByKey.has('name') ? [IMPORT_COLUMNS[0].header] : [];
  const rows = body.map((cells) => Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.key, (cells[indexByKey.get(column.key) ?? -1] || '').trim()])) as ImportRow);
  return { rows, missingColumns, ignoredColumns };
}

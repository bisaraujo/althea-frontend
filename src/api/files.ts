import { API_URL, ApiError } from './client';

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'arquivo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function fetchWithToken(token: string, path: string) {
  try {
    return await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }
}

async function failure(response: Response) {
  let message = 'Não foi possível baixar o arquivo.';
  try {
    const data = await response.json();
    if (data?.detail) message = String(data.detail);
  } catch {
    /* corpo sem JSON */
  }
  return new ApiError(message, response.status);
}

/** Baixa um arquivo de um endpoint autenticado e entrega ao navegador como download. */
export async function downloadAuthenticated(token: string, path: string, fileName: string) {
  const response = await fetchWithToken(token, path);
  if (!response.ok) throw await failure(response);
  saveBlob(await response.blob(), fileName);
}

/**
 * Baixa um arquivo guardado pela plataforma (envio de jornada ou ata) com o token do usuario.
 * Links externos que o backend nao reconhece sao abertos normalmente.
 */
export async function openStoredFile(token: string, fileUrl: string, fileName: string) {
  const response = await fetchWithToken(token, `/stored-files/download?url=${encodeURIComponent(fileUrl)}`);
  if (response.status === 404 && /^https?:\/\//i.test(fileUrl)) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!response.ok) throw await failure(response);
  saveBlob(await response.blob(), fileName);
}

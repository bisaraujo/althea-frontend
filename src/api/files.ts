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

/**
 * Baixa um arquivo guardado pela plataforma (envio de jornada ou ata) com o token do usuario.
 * Links externos que o backend nao reconhece sao abertos normalmente.
 */
export async function openStoredFile(token: string, fileUrl: string, fileName: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/stored-files/download?url=${encodeURIComponent(fileUrl)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }
  if (response.status === 404 && /^https?:\/\//i.test(fileUrl)) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!response.ok) {
    let message = 'Não foi possível baixar o arquivo.';
    try {
      const data = await response.json();
      if (data?.detail) message = String(data.detail);
    } catch {
      /* corpo sem JSON */
    }
    throw new ApiError(message, response.status);
  }
  saveBlob(await response.blob(), fileName);
}

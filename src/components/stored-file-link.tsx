import { type ReactNode, useState } from 'react';

import { ApiError } from '../api/client';
import { openStoredFile } from '../api/files';
import { useAuth } from '../auth/auth-context';
import { useToast } from './toast';

type StoredFileLinkProps = {
  fileUrl: string;
  fileName?: string | null;
  className?: string;
  children: ReactNode;
};

/** Link para arquivo enviado na plataforma: baixa com autenticacao em vez de expor uma URL publica. */
export function StoredFileLink({ fileUrl, fileName, className, children }: StoredFileLinkProps) {
  const { token } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!token || busy) return;
    setBusy(true);
    try {
      await openStoredFile(token, fileUrl, fileName || 'arquivo');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível baixar o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`stored-file-link ${className ?? ''}`.trim()} onClick={() => void handleClick()} disabled={busy} aria-busy={busy}>
      {children}
    </button>
  );
}

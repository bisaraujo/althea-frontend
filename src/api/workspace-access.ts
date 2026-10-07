import { useEffect, useState } from 'react';

import { getMyEffectiveAccess } from './services';

/** Permissoes que dao sentido a area "Gestao organizacional" fora do Administrador Geral. */
export const WORKSPACE_PERMISSIONS = [
  'organizacao.manage',
  'colaboradores.view',
  'colaboradores.custom_fields.view',
  'documentos.view',
  'organizacao.audit.view',
  'acessos.manage',
] as const;

const cache = new Map<string, Promise<Set<string>>>();

function loadPermissions(token: string, companyId: string) {
  const key = `${token}:${companyId}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = getMyEffectiveAccess(token, companyId).then((data) => new Set(data.permissions));
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/** Permissoes efetivas do usuario na propria empresa. `null` enquanto carrega; conjunto vazio se falhar. */
export function useMyPermissions(token: string | null, companyId: string | null | undefined) {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    loadPermissions(token, companyId)
      .then((value) => active && setPermissions(value))
      .catch(() => active && setPermissions(new Set()));
    return () => {
      active = false;
    };
  }, [token, companyId]);

  return permissions;
}

export function hasWorkspaceAccess(permissions: Set<string> | null) {
  return Boolean(permissions && WORKSPACE_PERMISSIONS.some((key) => permissions.has(key)));
}

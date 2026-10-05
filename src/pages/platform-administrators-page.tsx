import { Save, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  createAdministrator,
  getAdministrators,
  getProducts,
  updateAdministratorAccess,
} from '../api/services';
import type { Product, UserRecord } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatusPill } from '../components/status-pill';
import { useToast } from '../components/toast';

function message(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível salvar o administrador.';
}

export function PlatformAdministratorsPage() {
  const { token, user } = useAuth();
  const [admins, setAdmins] = useState<UserRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function reload() {
    if (!token) return;
    const [adminData, productData] = await Promise.all([getAdministrators(token), getProducts(token)]);
    setAdmins(adminData);
    setProducts(productData);
  }

  useEffect(() => { void reload().catch((reason) => setError(message(reason))); }, [token]);

  function toggleProduct(id: string) {
    setProductIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function edit(admin: UserRecord) {
    setEditingId(admin.id);
    setName(admin.name);
    setEmail(admin.email);
    setPlatformAdmin(admin.platform_admin);
    setProductIds(admin.admin_product_ids);
  }

  function clear() {
    setEditingId(null); setName(''); setEmail(''); setPlatformAdmin(false); setProductIds([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || saving) return;

    if (editingId) {
      const original = admins.find((item) => item.id === editingId);
      if (original && original.platform_admin !== platformAdmin) {
        const verb = platformAdmin ? 'conceder' : 'revogar';
        const confirmed = window.confirm(
          `Tem certeza que quer ${verb} acesso de Administrador Geral para ${original.name}? Isso ${platformAdmin ? 'dá controle total sobre a plataforma' : 'remove o controle total que essa pessoa tinha'}.`,
        );
        if (!confirmed) return;
      }
    }

    setSaving(true);
    try {
      const access = { platform_admin: platformAdmin, product_ids: productIds };
      if (editingId) {
        await updateAdministratorAccess(token, editingId, access);
        toast.success('Responsabilidades atualizadas.');
      } else {
        await createAdministrator(token, { name: name.trim(), email: email.trim(), ...access });
        toast.success('Administrador criado e acesso inicial enviado por e-mail.');
      }
      clear();
      await reload();
    } catch (reason) { toast.error(message(reason)); }
    finally { setSaving(false); }
  }

  return (
    <AppShell eyebrow="Administração geral" title="Responsabilidades administrativas" description="Separe quem governa a plataforma de quem opera cada produto." navigation={platformAdminNavigation}>
      {error ? <div className="form-error">{error}</div> : null}
      <SectionPanel title={editingId ? 'Editar responsabilidades' : 'Novo administrador'} eyebrow="Controle de acesso">
        <form className="admin-form" onSubmit={submit}>
          <label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} required disabled={Boolean(editingId)} /></label>
          <label><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={Boolean(editingId)} /></label>
          <label className="list-item list-item--rich">
            <div className="list-item__copy"><strong>Administrador Geral</strong><p>Empresas, catálogo, contratações e administradores.</p></div>
            <input type="checkbox" checked={platformAdmin} onChange={(event) => setPlatformAdmin(event.target.checked)} disabled={editingId === user?.id} />
          </label>
          <div className="admin-list">
            {products.map((product) => (
              <label className="list-item list-item--rich" key={product.id}>
                <div className="list-item__copy"><strong>Administrador de {product.name}</strong><p>Operação funcional deste produto.</p></div>
                <input type="checkbox" checked={productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
              </label>
            ))}
          </div>
          {!products.length && !platformAdmin ? <p className="form-hint">Cadastre um produto ou marque Administrador Geral.</p> : null}
          <div className="admin-action-link-group">
            {editingId ? <button type="button" className="secondary-button" onClick={clear}>Cancelar</button> : null}
            <button className="primary-button" disabled={saving || (!platformAdmin && !productIds.length)}>
              {editingId ? <Save size={16} /> : <UserPlus size={16} />}{editingId ? 'Salvar responsabilidades' : 'Criar administrador'}
            </button>
          </div>
        </form>
      </SectionPanel>
      <SectionPanel title="Administradores atuais" eyebrow={`${admins.length} acesso(s)`}>
        <div className="admin-list">
          {admins.map((admin) => (
            <article className="list-item list-item--rich" key={admin.id}>
              <UserCog size={18} />
              <div className="list-item__copy"><strong>{admin.name}</strong><p>{admin.email}</p><span>{admin.platform_admin ? 'Governança geral' : `${admin.admin_product_ids.length} produto(s)`}</span></div>
              <div className="admin-action-link-group">
                <StatusPill tone={admin.platform_admin ? 'success' : 'muted'}>{admin.platform_admin ? 'Admin Geral' : 'Admin de Produto'}</StatusPill>
                <button type="button" className="secondary-button" onClick={() => edit(admin)}><ShieldCheck size={15} />Responsabilidades</button>
              </div>
            </article>
          ))}
          {!admins.length ? <EmptyState title="Nenhum administrador" description="Crie um acesso administrativo acima." /> : null}
        </div>
      </SectionPanel>
    </AppShell>
  );
}

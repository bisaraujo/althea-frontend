import { PackageCheck, Pencil, Save } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getCompanyPortfolio, getProducts, updateProduct } from '../api/services';
import type { CompanyPortfolio, Product } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { platformAdminNavigation } from '../components/admin-navigation';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { InfoTooltip } from '../components/info-tooltip';
import { SectionPanel } from '../components/section-panel';
import { useToast } from '../components/toast';
import './companies-admin.css';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function ProductsModulesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<CompanyPortfolio[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [productData, portfolio] = await Promise.all([getProducts(token), getCompanyPortfolio(token)]);
    setProducts(productData);
    setCompanies(portfolio);
  }, [token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then(() => active && setLoadError(null))
      .catch((err: unknown) => active && setLoadError(errorMessage(err, 'Não foi possível carregar o catálogo.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  const companyCount = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((company) => company.products.forEach((product) => map.set(product.id, (map.get(product.id) ?? 0) + 1)));
    return map;
  }, [companies]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (!token || saving || !editingId) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      await updateProduct(token, editingId, payload);
      toast.success('Produto atualizado.');
      resetForm();
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível salvar o produto.'));
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description || '');
  }

  return (
    <AppShell
      eyebrow="Administração geral"
      title="Catálogo de produtos"
      description="Os produtos correspondem aos serviços integrados à plataforma. Aqui você consulta o catálogo e ajusta nome e descrição. A liberação para cada empresa é feita na página da própria empresa."
      navigation={platformAdminNavigation}
    >
      <div className="ca-page">
        {loadError ? <div className="form-error">{loadError}</div> : null}

        <SectionPanel
          title="Produtos disponíveis"
          eyebrow={loading ? 'Carregando' : `${products.length} produto(s)`}
          action={<InfoTooltip text="Produto é o que uma empresa contrata. Perfil de acesso, Pacote e Permissão são outros conceitos: definem o que cada colaborador pode fazer, e são geridos na Gestão organizacional." />}
        >
          {editingId ? (
            <form className="ca-catalog-form" onSubmit={submitProduct}>
              <h3>Editar produto</h3>
              <label>
                <span>Nome</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
              </label>
              <label>
                <span>Descrição</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
              </label>
              <div className="admin-action-link-group">
                <button type="button" className="secondary-button" onClick={resetForm}>Cancelar edição</button>
                <button type="submit" className="primary-button" disabled={saving || !name.trim()}>
                  <Save size={16} /><span>Salvar produto</span>
                </button>
              </div>
            </form>
          ) : null}

          {loading ? (
            <div className="ca-skeletons" aria-busy="true"><div className="ca-skeleton" /><div className="ca-skeleton" /></div>
          ) : !products.length ? (
            <EmptyState icon={PackageCheck} title="Nenhum produto no catálogo" description="Os produtos aparecem aqui conforme os serviços são integrados à plataforma." />
          ) : (
            <div className="ca-list">
              {products.map((product) => {
                const count = companyCount.get(product.id) ?? 0;
                return (
                  <article className="ca-catalog-item" key={product.id}>
                    <div className="ca-catalog-item__copy">
                      <strong>{product.name}</strong>
                      <p>{product.description || 'Sem descrição.'}</p>
                      <div className="ca-chips">
                        <span className={`ca-chip ${count ? '' : 'ca-chip--muted'}`}>{count ? `${count} empresa(s) com este produto` : 'Nenhuma empresa contratou'}</span>
                      </div>
                    </div>
                    <div className="ca-catalog-item__actions">
                      <button type="button" className="secondary-button" onClick={() => beginEdit(product)}><Pencil size={15} /><span>Editar</span></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!loading && products.length ? (
            <p className="form-hint">Para liberar ou retirar um produto de uma empresa, abra a empresa em <Link to="/platform-admin/companies">Empresas</Link>.</p>
          ) : null}
        </SectionPanel>
      </div>
    </AppShell>
  );
}

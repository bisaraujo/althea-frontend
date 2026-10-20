import { Lock } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMyCompanyProducts } from '../api/company';
import type { MyCompanyProducts } from '../api/company';
import { ApiError } from '../api/client';
import { getForms, getMyCompany, getPresentations, getProjects, getResponses } from '../api/services';
import type { Company, FormSummary, Presentation as PresentationType, Project, ResponseRecord } from '../api/types';
import { AppShell } from '../components/app-shell';
import { CompanyAvatar } from '../components/company-avatar';
import { companyNavigation } from '../components/company-navigation';
import { StatusPill } from '../components/status-pill';
import { DataTable, ErrorState, LoadingState, SearchInput, SectionHeader } from '../components/ui';
import type { DataTableColumn } from '../components/ui';
import { useAuth } from '../auth/auth-context';
import './company-dashboard.css';

const FORMS_PAGE = 8;

const audienceLabel: Record<string, string> = { all: 'Todos', manager: 'Gestores', employee: 'Colaboradores' };

type JornadasData = {
  projects: Project[];
  forms: FormSummary[];
  presentations: PresentationType[];
  responses: ResponseRecord[];
};

function LockedProduct({ text }: { text: string }) {
  return (
    <div className="cd-locked">
      <Lock size={16} aria-hidden />
      <div>
        <strong>Produto não contratado</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export function CompanyDashboard() {
  const { token, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<MyCompanyProducts | null>(null);
  const [data, setData] = useState<JornadasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formSearch, setFormSearch] = useState('');
  const [formLimit, setFormLimit] = useState(FORMS_PAGE);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [companyData, productData] = await Promise.all([getMyCompany(token), getMyCompanyProducts(token)]);
      setCompany(companyData);
      setProducts(productData);
      if (productData.has_jornadas) {
        const [projectData, formData, presentationData, responseData] = await Promise.all([
          getProjects(token),
          getForms(token),
          getPresentations(token),
          getResponses(token),
        ]);
        setData({
          projects: projectData.projects,
          forms: formData.forms,
          presentations: presentationData.presentations,
          responses: responseData.responses,
        });
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a área da empresa.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredForms = useMemo(() => {
    const term = formSearch.trim().toLowerCase();
    const all = data?.forms ?? [];
    return term ? all.filter((f) => `${f.title} ${f.description ?? ''}`.toLowerCase().includes(term)) : all;
  }, [data, formSearch]);

  const formTitles = useMemo(() => new Map((data?.forms ?? []).map((f) => [f.id, f.title])), [data]);

  const projectColumns: DataTableColumn<Project>[] = [
    { key: 'name', header: 'Projeto', render: (p) => <strong>{p.name}</strong> },
    { key: 'description', header: 'Descrição', hideOnMobile: true, render: (p) => p.description || '—' },
  ];

  if (!user) return null;

  const hasJornadas = Boolean(products?.has_jornadas);

  return (
    <AppShell
      eyebrow="Plataforma de Jornadas"
      title="Jornadas"
      description="Projetos, formulários, apresentações e respostas da Plataforma de Jornadas."
      navigation={companyNavigation}
    >
      {loading ? (
        <LoadingState />
      ) : error || !company ? (
        <ErrorState message={error ?? undefined} onRetry={() => void load()} />
      ) : (
        <div className="cd-stack">
          <section className="panel cd-header" aria-label="Dados institucionais">
            <CompanyAvatar name={company.name} size="lg" />
            <div className="cd-header__main">
              <h2>{company.name}</h2>
              <p>{company.email}</p>
            </div>
            <div className="cd-header__products">
              {products?.products.length ? (
                products.products.map((p) => (
                  <StatusPill key={p.id} tone="success">
                    {p.name}
                  </StatusPill>
                ))
              ) : hasJornadas ? (
                <StatusPill tone="success">Plataforma de Jornadas</StatusPill>
              ) : (
                <StatusPill>Nenhum produto contratado</StatusPill>
              )}
            </div>
          </section>

          {hasJornadas && data ? (
            <>
              <div className="cd-stats">
                <span className="cd-stat"><strong>{data.projects.length}</strong> projetos</span>
                <span className="cd-stat"><strong>{data.forms.length}</strong> formulários</span>
                <span className="cd-stat"><strong>{data.presentations.length}</strong> apresentações</span>
                <span className="cd-stat"><strong>{data.responses.length}</strong> respostas</span>
              </div>

              <section className="panel cd-panel">
                <SectionHeader title="Projetos" count={data.projects.length} />
                <DataTable
                  dense
                  columns={projectColumns}
                  rows={data.projects}
                  rowKey={(p) => p.id}
                  empty={<p className="cd-empty">Nenhum projeto cadastrado para esta empresa.</p>}
                />
              </section>

              <section className="panel cd-panel">
                <SectionHeader
                  title="Formulários e pesquisas"
                  count={data.forms.length}
                  actions={
                    data.forms.length > FORMS_PAGE ? (
                      <SearchInput
                        value={formSearch}
                        onChange={(v) => {
                          setFormSearch(v);
                          setFormLimit(FORMS_PAGE);
                        }}
                        placeholder="Buscar formulário"
                      />
                    ) : undefined
                  }
                />
                {filteredForms.length ? (
                  <>
                    <ul className="cd-list">
                      {filteredForms.slice(0, formLimit).map((form) => (
                        <li key={form.id}>
                          <div className="cd-list__text">
                            <strong>{form.title}</strong>
                            <span>{form.description || 'Sem descrição.'}</span>
                          </div>
                          <StatusPill>{audienceLabel[form.audience] ?? form.audience}</StatusPill>
                        </li>
                      ))}
                    </ul>
                    {filteredForms.length > formLimit ? (
                      <button type="button" className="cd-more" onClick={() => setFormLimit((n) => n + FORMS_PAGE)}>
                        Ver mais ({filteredForms.length - formLimit})
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="cd-empty">{formSearch ? 'Nenhum formulário encontrado para a busca.' : 'Nenhum formulário ainda.'}</p>
                )}
              </section>

              <div className="cd-grid">
                <section className="panel cd-panel">
                  <SectionHeader title="Apresentações" count={data.presentations.length} />
                  {data.presentations.length ? (
                    <ul className="cd-list">
                      {data.presentations.slice(0, 5).map((presentation) => (
                        <li key={presentation.id}>
                          <div className="cd-list__text">
                            <strong>{presentation.title}</strong>
                            <span>{presentation.description || 'Sem descrição.'}</span>
                          </div>
                          {presentation.file_url ? (
                            <a href={presentation.file_url} target="_blank" rel="noreferrer" className="secondary-link">
                              abrir
                            </a>
                          ) : (
                            <span className="secondary-link">em breve</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="cd-empty">Nenhuma apresentação ainda.</p>
                  )}
                </section>

                <section className="panel cd-panel">
                  <SectionHeader title="Respostas recentes" count={data.responses.length} />
                  {data.responses.length ? (
                    <ul className="cd-list">
                      {data.responses.slice(0, 5).map((response) => (
                        <li key={response.id}>
                          <div className="cd-list__text">
                            <strong>{formTitles.get(response.form_id) ?? `Formulário ${response.form_id.slice(0, 8)}`}</strong>
                            <span>Resposta {response.id.slice(0, 8)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="cd-empty">Nenhuma resposta registrada.</p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <LockedProduct text="Projetos, formulários, jornadas, apresentações e respostas fazem parte da Plataforma de Jornadas. Fale com a turi para contratar." />
          )}
        </div>
      )}
    </AppShell>
  );
}

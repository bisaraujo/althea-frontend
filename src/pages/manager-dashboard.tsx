import { ClipboardList, FolderInput, Presentation, Users } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  getManagerEmployees,
  getManagerForms,
  getManagerJourney,
  getManagerPresentations,
  getManagerResponses,
  uploadManagerDocument,
} from '../api/services';
import type {
  DocumentSubmissionPayload,
  EmployeeRecord,
  FormSummary,
  Journey,
  JourneyItem,
  Presentation as PresentationType,
  ResponseRecord,
} from '../api/types';
import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { SectionPanel } from '../components/section-panel';
import { StatCard } from '../components/stat-card';
import { StatusPill } from '../components/status-pill';
import { useAuth } from '../auth/auth-context';

const initialDocumentState: DocumentSubmissionPayload = {
  file_name: '',
  file_url: '',
  mime_type: '',
  notes: '',
};

function statusTone(status?: string) {
  if (status === 'submitted' || status === 'completed') {
    return 'success';
  }

  if (status === 'overdue') {
    return 'warning';
  }

  return 'muted';
}

export function ManagerDashboard() {
  const { token, user, signOut } = useAuth();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [presentations, setPresentations] = useState<PresentationType[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [documentPayloads, setDocumentPayloads] = useState<Record<string, DocumentSubmissionPayload>>({});
  const [submittingItem, setSubmittingItem] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    const authToken: string = token;

    async function load() {
      try {
        const [journeyData, employeeData, formData, presentationData, responseData] = await Promise.all([
          getManagerJourney(authToken),
          getManagerEmployees(authToken),
          getManagerForms(authToken),
          getManagerPresentations(authToken),
          getManagerResponses(authToken),
        ]);

        setJourney(journeyData);
        setEmployees(employeeData.employees);
        setForms(formData.forms);
        setPresentations(presentationData.presentations);
        setResponses(responseData.responses);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Nao foi possivel carregar a jornada do gestor.');
      }
    }

    void load();
  }, [token]);

  function setDocumentField(itemId: string, field: keyof DocumentSubmissionPayload, value: string) {
    setDocumentPayloads((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? initialDocumentState),
        [field]: value,
      },
    }));
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>, item: JourneyItem) {
    event.preventDefault();

    if (!token) {
      return;
    }
    const authToken: string = token;

    const payload = documentPayloads[item.id] ?? initialDocumentState;
    setSubmittingItem(item.id);
    setError(null);

    try {
      await uploadManagerDocument(authToken, item.id, payload);
      const freshJourney = await getManagerJourney(authToken);
      setJourney(freshJourney);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel enviar o documento agora.');
    } finally {
      setSubmittingItem(null);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell
      user={user}
      title="Jornada do gestor"
      subtitle="Uma trilha propria para alinhamento metodologico, entregas documentais e acompanhamento do time."
      onSignOut={signOut}
    >
      {error ? <div className="form-error">{error}</div> : null}

      <div className="stats-grid">
        <StatCard label="Etapas da jornada" value={journey?.sections.length ?? 0} icon={<FolderInput size={18} />} />
        <StatCard label="Funcionarios" value={employees.length} icon={<Users size={18} />} />
        <StatCard label="Formularios visiveis" value={forms.length} icon={<ClipboardList size={18} />} />
        <StatCard label="Apresentacoes" value={presentations.length} icon={<Presentation size={18} />} />
      </div>

      <SectionPanel
        title={journey?.title ?? 'Jornada do gestor'}
        eyebrow="Trilha principal"
        action={<StatusPill tone="success">{journey?.status ?? 'active'}</StatusPill>}
      >
        {journey ? (
          <div className="journey">
            {journey.sections.map((section) => (
              <article key={section.id} className="journey-section">
                <header className="journey-section__header">
                  <div>
                    <span className="journey-section__order">{section.order}</span>
                    <div>
                      <h3>{section.title}</h3>
                      <p>{section.description || 'Sem descricao para esta etapa.'}</p>
                    </div>
                  </div>
                </header>

                <div className="journey-items">
                  {section.items.map((item) => (
                    <div key={item.id} className="journey-item">
                      <div className="journey-item__meta">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.description || 'Sem descricao do item.'}</p>
                        </div>
                        <div className="journey-item__badges">
                          <StatusPill>{item.item_type}</StatusPill>
                          <StatusPill tone={statusTone(item.user_status)}>{item.user_status ?? 'available'}</StatusPill>
                        </div>
                      </div>

                      {item.content_text ? <p className="journey-item__content">{item.content_text}</p> : null}
                      {item.video_url ? (
                        <a className="secondary-link" href={item.video_url} target="_blank" rel="noreferrer">
                          abrir video
                        </a>
                      ) : null}

                      {item.item_type === 'document_request' ? (
                        <form className="document-form" onSubmit={(event) => handleDocumentSubmit(event, item)}>
                          <div className="document-form__grid">
                            <label>
                              <span>Nome do arquivo</span>
                              <input
                                value={documentPayloads[item.id]?.file_name ?? ''}
                                onChange={(event) =>
                                  setDocumentField(item.id, 'file_name', event.target.value)
                                }
                                placeholder={item.document_title ?? 'Documento'}
                                required
                              />
                            </label>
                            <label>
                              <span>URL do arquivo</span>
                              <input
                                value={documentPayloads[item.id]?.file_url ?? ''}
                                onChange={(event) =>
                                  setDocumentField(item.id, 'file_url', event.target.value)
                                }
                                placeholder="https://..."
                                required
                              />
                            </label>
                          </div>

                          <div className="document-form__grid">
                            <label>
                              <span>MIME type</span>
                              <input
                                value={documentPayloads[item.id]?.mime_type ?? ''}
                                onChange={(event) =>
                                  setDocumentField(item.id, 'mime_type', event.target.value)
                                }
                                placeholder="application/pdf"
                                required
                              />
                            </label>
                            <label>
                              <span>Formatos aceitos</span>
                              <input value={item.accepted_formats.join(', ') || 'Nao informado'} disabled />
                            </label>
                          </div>

                          <label>
                            <span>Observacoes</span>
                            <textarea
                              rows={3}
                              value={documentPayloads[item.id]?.notes ?? ''}
                              onChange={(event) => setDocumentField(item.id, 'notes', event.target.value)}
                              placeholder="Observacoes opcionais para contextualizar a entrega."
                            />
                          </label>

                          <button type="submit" className="primary-button" disabled={submittingItem === item.id}>
                            {submittingItem === item.id ? 'Enviando...' : 'Registrar entrega'}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sem jornada ativa"
            description="Quando uma jornada manager estiver ativa para o projeto deste usuario, ela vai aparecer aqui."
          />
        )}
      </SectionPanel>

      <div className="content-grid">
        <SectionPanel title="Equipe do projeto" eyebrow="People" action={<StatusPill>{employees.length} pessoas</StatusPill>}>
          {employees.length ? (
            <div className="list">
              {employees.map((employee) => (
                <article key={employee.id} className="list-item">
                  <div>
                    <strong>{employee.name}</strong>
                    <p>{employee.email}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem funcionarios vinculados"
              description="Quando o projeto tiver colaboradores associados, eles vao aparecer aqui."
            />
          )}
        </SectionPanel>

        <SectionPanel title="Respostas do projeto" eyebrow="Acompanhamento" action={<StatusPill>{responses.length} registros</StatusPill>}>
          {responses.length ? (
            <div className="list">
              {responses.slice(0, 6).map((response) => (
                <article key={response.id} className="list-item">
                  <div>
                    <strong>Resposta {response.id.slice(0, 8)}</strong>
                    <p>Formulario {response.form_id.slice(0, 8)} • Usuario {response.user_id.slice(0, 8)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem respostas ainda"
              description="As respostas do projeto vao aparecer aqui para acompanhamento do gestor."
            />
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}

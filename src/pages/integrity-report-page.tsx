import { AlertTriangle, Copy, FileSearch, Lock, Paperclip, ShieldCheck, UserX } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  getPublicIntegrityForm, INTEGRITY_ATTACHMENT_ACCEPT, INTEGRITY_ATTACHMENT_MAX_MB, INTEGRITY_CATEGORIES,
  type IntegrityForm, type IntegrityQuestion, type IntegritySubmitResult, submitIntegrityReport,
} from '../api/integrity';
import { BrandLockup } from '../components/brand';
import { useToast } from '../components/toast';
import { ErrorState, LoadingState } from '../components/ui';
import { copyText } from './integrity-shared';
import './integrity.css';

type Answers = Record<string, string | string[]>;

function isAnswered(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && value.trim());
}

function QuestionField({ question, value, onChange }: { question: IntegrityQuestion; value: string | string[] | undefined; onChange: (value: string | string[]) => void }) {
  const label = <>{question.label}{question.required ? <span className="int-required"> *</span> : <span className="int-optional"> (opcional)</span>}</>;
  const options = question.options ?? [];
  if (question.type === 'long_text') {
    return <label>{label}<textarea value={(value as string) ?? ''} onChange={(event) => onChange(event.target.value)} required={question.required} maxLength={4000} /></label>;
  }
  if (question.type === 'select') {
    return (
      <label>{label}
        <select value={(value as string) ?? ''} onChange={(event) => onChange(event.target.value)} required={question.required}>
          <option value="">Selecione…</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (question.type === 'radio' || question.type === 'checkbox') {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <fieldset>
        <legend className="int-field">{label}</legend>
        <div className="int-choices">
          {options.map((option) => (
            <label key={option}>
              <input
                type={question.type}
                name={question.key}
                checked={selected.includes(option)}
                onChange={() => onChange(question.type === 'radio' ? option : selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return <label>{label}<input value={(value as string) ?? ''} onChange={(event) => onChange(event.target.value)} required={question.required} maxLength={500} /></label>;
}

function Receipt({ result }: { result: IntegritySubmitResult }) {
  const toast = useToast();
  async function copy(text: string, what: string) {
    if (await copyText(text)) toast.success(`${what} copiado.`);
    else toast.error('Não foi possível copiar. Anote manualmente.');
  }
  return (
    <div className="int-receipt" aria-live="polite">
      <span className="int-public__eyebrow"><ShieldCheck size={15} aria-hidden />Denúncia registrada</span>
      <h1>Recebemos sua denúncia</h1>
      <p className="int-public__lead">Ela segue em sigilo para o comitê responsável. Use os dados abaixo para acompanhar o andamento sem precisar se identificar.</p>
      <div className="int-receipt__keys">
        <div className="int-key"><span>Protocolo</span><code>{result.protocol}</code><button type="button" className="secondary-button" onClick={() => void copy(result.protocol, 'Protocolo')}><Copy size={14} />Copiar</button></div>
        <div className="int-key"><span>Chave de acesso</span><code>{result.access_key}</code><button type="button" className="secondary-button" onClick={() => void copy(result.access_key, 'Chave')}><Copy size={14} />Copiar</button></div>
      </div>
      <p className="int-warning"><AlertTriangle size={17} aria-hidden /><span><strong>Guarde o protocolo e a chave agora.</strong> Por segurança, a chave não é guardada de forma legível e não pode ser recuperada.</span></p>
      <div className="int-actions">
        <Link to="/denuncia/acompanhar" className="primary-button"><FileSearch size={16} />Acompanhar denúncia</Link>
      </div>
    </div>
  );
}

export function IntegrityReportPage() {
  const { companyId = '' } = useParams();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<IntegrityForm | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [identified, setIdentified] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<IntegritySubmitResult | null>(null);

  function load() {
    setLoadFailed(false);
    getPublicIntegrityForm(companyId).then(setForm).catch(() => setLoadFailed(true));
  }
  useEffect(load, [companyId]);

  function pickFile(next: File | null) {
    if (next && next.size > INTEGRITY_ATTACHMENT_MAX_MB * 1024 * 1024) {
      toast.error(`O arquivo passa do limite de ${INTEGRITY_ATTACHMENT_MAX_MB} MB.`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setFile(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || !form) return;
    const missing = form.questions.find((question) => question.required && !isAnswered(answers[question.key]));
    if (missing) {
      toast.error(`Responda: ${missing.label}`);
      return;
    }
    setSending(true);
    try {
      const sent = await submitIntegrityReport(companyId, {
        description: description.trim(), category, incident_date: incidentDate || null, identified,
        reporter_name: name.trim() || null, reporter_email: email.trim() || null, custom_answers: answers, file,
      });
      setResult(sent);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Não foi possível enviar a denúncia. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="int-public">
      <header className="int-public__header">
        <BrandLockup />
        <nav><Link to="/denuncia/acompanhar">Já fez uma denúncia? Acompanhe</Link></nav>
      </header>
      <section className="int-public__card">
        {result ? <Receipt result={result} /> : loadFailed ? (
          <ErrorState title="Canal indisponível" message="Não encontramos o canal de denúncias desta empresa. Confira o link recebido." onRetry={load} />
        ) : !form ? <LoadingState label="Carregando o formulário…" /> : (
          <>
            <span className="int-public__eyebrow"><ShieldCheck size={15} aria-hidden />Canal de Denúncias{form.company_name ? ` · ${form.company_name}` : ''}</span>
            <h1>Relate uma situação com segurança</h1>
            <p className="int-public__lead">Use este canal para relatar condutas que vão contra a ética, a lei ou as políticas da empresa. O relato vai direto para o comitê responsável.</p>
            <ul className="int-assurances">
              <li><UserX size={18} aria-hidden /><div><strong>Anônimo por padrão</strong><span>Você só se identifica se quiser.</span></div></li>
              <li><Lock size={18} aria-hidden /><div><strong>Sigilo</strong><span>Só o comitê tem acesso ao relato e aos anexos.</span></div></li>
              <li><FileSearch size={18} aria-hidden /><div><strong>Acompanhamento</strong><span>Você recebe um protocolo para ver o andamento.</span></div></li>
            </ul>
            <form className="int-form" onSubmit={(event) => void submit(event)}>
              <fieldset disabled={sending}>
                <label>Assunto<span className="int-required"> *</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} required>
                    <option value="">Selecione o assunto…</option>
                    {INTEGRITY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label>O que aconteceu?<span className="int-required"> *</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={8000} placeholder="Conte o que aconteceu, onde, quando e quem estava envolvido. Quanto mais detalhes, melhor a apuração." />
                </label>
                <label>Quando aconteceu? <span className="int-optional">(opcional)</span>
                  <input type="date" value={incidentDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setIncidentDate(event.target.value)} />
                </label>
                {form.questions.map((question) => (
                  <QuestionField key={question.key} question={question} value={answers[question.key]} onChange={(value) => setAnswers((current) => ({ ...current, [question.key]: value }))} />
                ))}
                <div className="int-field">
                  <span>Anexo <span className="int-optional">(opcional)</span></span>
                  <div className="int-file">
                    <input ref={fileInput} id="int-file" type="file" accept={INTEGRITY_ATTACHMENT_ACCEPT} onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
                    <label htmlFor="int-file" className="secondary-button"><Paperclip size={15} />{file ? 'Trocar arquivo' : 'Anexar evidência'}</label>
                    {file ? <span className="int-file__name">{file.name}</span> : null}
                    {file ? <button type="button" className="secondary-button" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Remover</button> : null}
                  </div>
                  <p className="int-hint">PDF, imagens, documentos do Office ou texto, até {INTEGRITY_ATTACHMENT_MAX_MB} MB.</p>
                </div>
                <label className="int-identify">
                  <input type="checkbox" checked={identified} onChange={(event) => setIdentified(event.target.checked)} />
                  <div><strong>Quero me identificar</strong><span>Opcional. Ajuda o comitê a falar com você se precisar de mais informações.</span></div>
                </label>
                {identified ? (
                  <>
                    <label>Seu nome<span className="int-required"> *</span><input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" maxLength={255} /></label>
                    <label>Seu e-mail<span className="int-required"> *</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" maxLength={255} /></label>
                  </>
                ) : null}
                <button type="submit" className="primary-button int-submit" disabled={sending || !category || !description.trim()}>{sending ? 'Enviando…' : 'Enviar denúncia'}</button>
              </fieldset>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

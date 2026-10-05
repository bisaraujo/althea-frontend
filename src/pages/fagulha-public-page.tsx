import { Flame } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getPublicFagulhaCampaign, submitPublicFagulhaResponse } from '../api/services';
import type { FagulhaCampaign } from '../api/types';
import { BrandLockup } from '../components/brand';

export function FagulhaPublicPage() {
  const { companyId = '', slug = '' } = useParams();
  const [campaign, setCampaign] = useState<FagulhaCampaign | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getPublicFagulhaCampaign(companyId, slug).then(setCampaign).catch(() => setError('Esta campanha não está disponível.')); }, [companyId, slug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await submitPublicFagulhaResponse(companyId, slug, { participant_name: name, participant_email: email, answers });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Não foi possível enviar. Confira os campos obrigatórios.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="public-fagulha"><header><BrandLockup/><span><Flame size={18}/>Fagulha</span></header><section className="public-fagulha__card" aria-live="polite">{sent ? <><Flame size={40}/><h1>Resposta recebida</h1><p>Obrigado por participar desta experiência.</p></> : campaign ? <><p className="panel__eyebrow">Experiência Fagulha</p><h1>{campaign.title}</h1><p>{campaign.description}</p>{error ? <div className="alert alert--error" role="alert">{error}</div> : null}<form className="stack-form" onSubmit={submit}><label>Seu nome<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Seu e-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>{campaign.questions.map((question) => <label key={question.key}>{question.title}<input value={answers[question.key] || ''} onChange={(e) => setAnswers((current) => ({ ...current, [question.key]: e.target.value }))} required={question.required}/></label>)}<button className="primary-button" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar respostas'}</button></form></> : <><h1>Fagulha</h1><p role={error ? 'alert' : 'status'}>{error || 'Carregando campanha...'}</p></>}</section></main>;
}

import { FileSearch, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { ApiError } from '../api/client';
import { categoryLabel, type IntegrityTrackResult, trackIntegrityReport } from '../api/integrity';
import { BrandLockup } from '../components/brand';
import { StatusPill } from '../components/status-pill';
import { CaseTimeline, formatDateTime, statusLabel } from './integrity-shared';
import './integrity.css';

export function IntegrityTrackPage() {
  const [protocol, setProtocol] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntegrityTrackResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (searching) return;
    setSearching(true); setError(null);
    try {
      setResult(await trackIntegrityReport(protocol.trim().toUpperCase(), accessKey.trim()));
    } catch (reason) {
      setResult(null);
      setError(reason instanceof ApiError && reason.status === 404 ? 'Protocolo ou chave de acesso não conferem. Confira os dados e tente de novo.' : reason instanceof ApiError ? reason.message : 'Não foi possível consultar agora. Tente novamente.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="int-public">
      <header className="int-public__header"><BrandLockup /></header>
      <section className="int-public__card">
        <span className="int-public__eyebrow"><FileSearch size={15} aria-hidden />Canal de Denúncias</span>
        <h1>Acompanhe sua denúncia</h1>
        <p className="int-public__lead">Informe o protocolo e a chave de acesso que você recebeu ao enviar a denúncia. Nenhum dado pessoal é pedido.</p>
        <form className="int-form" onSubmit={(event) => void submit(event)} style={{ marginTop: '1.2rem' }}>
          <fieldset disabled={searching}>
            <label>Protocolo<input value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="DEN-2026-XXXXXXXX" required autoComplete="off" /></label>
            <label>Chave de acesso<input value={accessKey} onChange={(event) => setAccessKey(event.target.value)} required autoComplete="off" /></label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button type="submit" className="primary-button int-submit">{searching ? 'Consultando…' : 'Consultar andamento'}</button>
          </fieldset>
        </form>
        {result ? (
          <div className="int-drawer-section" style={{ marginTop: '1.4rem' }} aria-live="polite">
            <div className="int-case-head">
              <span className="int-protocol">{result.protocol}</span>
              <StatusPill tone={result.status === 'concluido' ? 'success' : result.status === 'em_analise' ? 'warning' : 'default'}>{statusLabel(result.status)}</StatusPill>
            </div>
            <p className="int-hint">Assunto: {categoryLabel(result.category)} · enviada em {formatDateTime(result.created_at)} · última atualização em {formatDateTime(result.updated_at)}</p>
            <h3>Andamento</h3>
            <CaseTimeline events={result.events} audience="public" />
          </div>
        ) : null}
        <p className="int-hint" style={{ marginTop: '1.2rem' }}><ShieldCheck size={13} aria-hidden /> Perdeu a chave? Por segurança ela não pode ser recuperada. Se precisar, faça um novo relato citando o protocolo anterior.</p>
      </section>
    </main>
  );
}

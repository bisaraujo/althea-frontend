import { Flame } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { activateFagulhaInvite } from '../api/services';
import { BrandLockup } from '../components/brand';

export function FagulhaActivationPage() {
  const { token = '' } = useParams();
  const [status, setStatus] = useState<'ready' | 'loading' | 'done' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState('');

  async function activate() {
    setStatus('loading');
    try {
      await activateFagulhaInvite(token);
      setStatus('done');
    } catch (reason) {
      setErrorMessage(reason instanceof ApiError ? reason.message : 'Este convite é inválido, expirou ou foi revogado.');
      setStatus('error');
    }
  }

  return <main className="public-fagulha"><header><BrandLockup/><span><Flame size={18}/>Fagulha</span></header><section className="public-fagulha__card" aria-live="polite"><Flame size={40}/><h1>{status === 'done' ? 'Acesso ativado' : 'Ative seu acesso ao Fagulha'}</h1><p>{status === 'done' ? 'Seu convite foi confirmado com sucesso.' : status === 'error' ? errorMessage : status === 'loading' ? 'Estamos confirmando seu convite…' : 'Confirme para participar das experiências da sua empresa.'}</p>{status === 'ready' || status === 'error' ? <button className="primary-button" onClick={() => void activate()}>{status === 'error' ? 'Tentar novamente' : 'Ativar meu acesso'}</button> : null}</section></main>;
}

import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, Flame, KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { confirmPasswordReset, login, requestPasswordReset } from '../api/services';
import type { AuthenticatedUser } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { BrandLockup } from '../components/brand';

type LoginMode = 'login' | 'request-reset' | 'confirm-reset';

function userDestination(user: AuthenticatedUser) {
  switch (user.role) {
    case 'company': return '/company';
    case 'manager': return '/manager';
    case 'employee': return '/employee';
    case 'admin':
      if (user.platform_admin) return '/platform-admin/companies';
      return user.admin_product_ids?.includes('product-jornadas') ? '/admin' : '/fagulha-admin';
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<LoginMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === 'confirm-reset' && newPassword !== passwordConfirmation) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const data = await login(email, password);
        signIn(data.access_token, data.user);
        navigate(userDestination(data.user), { replace: true });
        return;
      }

      if (mode === 'request-reset') {
        const data = await requestPasswordReset(email);
        setMode('confirm-reset');
        setSuccess(data.message);
        return;
      }

      const data = await confirmPasswordReset(email, code, newPassword);
      setPassword('');
      setCode('');
      setNewPassword('');
      setPasswordConfirmation('');
      setMode('login');
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir agora.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const header = mode === 'login'
    ? { tag: 'Entrar', title: 'Acesse sua área', description: 'Use seu email corporativo para continuar a jornada.' }
    : mode === 'request-reset'
      ? { tag: 'Recuperação', title: 'Redefina sua senha', description: 'Enviaremos um código de acesso para seu email.' }
      : { tag: 'Código enviado', title: 'Crie uma nova senha', description: `Use o código enviado para ${email}.` };

  return (
    <div className="login-page">
      <section className="login-story" aria-label="turi">
        <BrandLockup tone="light" subtitle="Hub turi para jornadas psicossociais" />
        <div className="login-story__copy">
          <span className="login-card__tag">plataforma viva</span>
          <h1>Cuidado que vira dado.<span> Dado que vira decisão.</span></h1>
          <p>Acompanhe jornadas, riscos, entregas e evidências em um ambiente inspirado na nova identidade da turi.</p>
        </div>
        <div className="login-proof-grid">
          <span><Flame size={16} /> Pulso em tempo real</span>
          <span><ShieldCheck size={16} /> Compliance rastreável</span>
          <span><BarChart3 size={16} /> Jornada mensurável</span>
        </div>
      </section>

      <div className="login-card">
        <div className="login-card__header">
          <span className="login-card__tag">{header.tag}</span>
          <h2>{header.title}</h2>
          <p>{header.description}</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={mode === 'confirm-reset'}
              required
            />
          </label>

          {mode === 'login' ? (
            <label>
              <span>Senha</span>
              <input type="password" autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
          ) : null}

          {mode === 'confirm-reset' ? (
            <>
              <label>
                <span>Código de acesso</span>
                <input className="reset-code-input" inputMode="numeric" autoComplete="one-time-code" placeholder="00000000" maxLength={8} pattern="[0-9]{8}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required />
              </label>
              <label>
                <span>Nova senha</span>
                <input type="password" autoComplete="new-password" minLength={10} placeholder="Ao menos 10 caracteres" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              </label>
              <label>
                <span>Confirme a nova senha</span>
                <input type="password" autoComplete="new-password" minLength={10} placeholder="Repita a nova senha" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required />
              </label>
            </>
          ) : null}

          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {success ? <div className="form-success" role="status">{success}</div> : null}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {mode === 'login' ? <><span>{isSubmitting ? 'Entrando...' : 'Entrar na plataforma'}</span><ArrowRight size={17} /></> : null}
            {mode === 'request-reset' ? <><span>{isSubmitting ? 'Enviando...' : 'Enviar código'}</span><KeyRound size={17} /></> : null}
            {mode === 'confirm-reset' ? <><span>{isSubmitting ? 'Salvando...' : 'Redefinir senha'}</span><ShieldCheck size={17} /></> : null}
          </button>

          <div className="login-card__actions">
            {mode === 'login' ? (
              <button type="button" className="text-button" onClick={() => changeMode('request-reset')}>Esqueci minha senha</button>
            ) : (
              <button type="button" className="text-button" onClick={() => changeMode('login')}><ArrowLeft size={15} /> Voltar ao login</button>
            )}
            {mode === 'confirm-reset' ? (
              <button type="button" className="text-button" onClick={() => changeMode('request-reset')}>Reenviar código</button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

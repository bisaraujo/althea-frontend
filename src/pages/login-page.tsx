import { FormEvent, useState } from 'react';
import { ArrowRight, BarChart3, Flame, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { login } from '../api/services';
import { useAuth } from '../auth/auth-context';
import { BrandLockup } from '../components/brand';

function roleDestination(role: string) {
  switch (role) {
    case 'company':
      return '/company';
    case 'manager':
      return '/manager';
    case 'employee':
      return '/employee';
    default:
      return '/admin';
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await login(email, password);
      signIn(data.access_token, data.user);
      navigate(roleDestination(data.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar agora.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-story" aria-label="turi">
        <BrandLockup tone="light" subtitle="Hub turi para jornadas psicossociais" />
        <div className="login-story__copy">
          <span className="login-card__tag">plataforma viva</span>
          <h1>
            Cuidado que vira dado.
            <span> Dado que vira decisão.</span>
          </h1>
          <p>
            Acompanhe jornadas, riscos, entregas e evidências em um ambiente inspirado na
            nova identidade da turi.
          </p>
        </div>
        <div className="login-proof-grid">
          <span><Flame size={16} /> Pulso em tempo real</span>
          <span><ShieldCheck size={16} /> Compliance rastreável</span>
          <span><BarChart3 size={16} /> Jornada mensurável</span>
        </div>
      </section>

      <div className="login-card">
        <div className="login-card__header">
          <span className="login-card__tag">Entrar</span>
          <h2>Acesse sua área</h2>
          <p>Use seu e-mail corporativo para continuar a jornada.</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit}>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Senha</span>
            <input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Entrando...' : 'Entrar na plataforma'}</span>
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}

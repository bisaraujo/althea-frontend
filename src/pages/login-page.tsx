import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { login } from '../api/services';
import { useAuth } from '../auth/auth-context';

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
      <div className="login-card">
        <div className="login-card__brand">
          <span className="login-card__brand-mark">A</span>
          <div>
            <strong>Althea</strong>
            <p>Plataforma de gestão de jornada</p>
          </div>
        </div>

        <div className="login-card__header">
          <span className="login-card__tag">Entrar</span>
          <h2>Acesse sua área</h2>
          <p>Entre com seu e-mail e sua senha para continuar.</p>
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
            {isSubmitting ? 'Entrando...' : 'Entrar na plataforma'}
          </button>
        </form>
      </div>
    </div>
  );
}

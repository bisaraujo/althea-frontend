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
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel entrar agora.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__hero">
        <span className="login-page__eyebrow">Risk management platform</span>
        <h1>Uma jornada guiada para acolher, orientar e acompanhar cada etapa.</h1>
        <p>
          A nova base da Althea organiza conteudo, pesquisas e entregas por perfil, sem perder
          continuidade entre onboarding, sensibilizacao e acompanhamento.
        </p>

        <div className="login-page__highlights">
          <article>
            <strong>Funcionario</strong>
            <p>Recebe trilhas claras com conteudo, apresentacoes e pesquisas na ordem certa.</p>
          </article>
          <article>
            <strong>Gestor</strong>
            <p>Tem uma area propria para entregas documentais, alinhamento metodologico e time.</p>
          </article>
          <article>
            <strong>Empresa</strong>
            <p>Acompanha a operacao da propria conta, projetos e respostas com contexto.</p>
          </article>
        </div>
      </div>

      <div className="login-card">
        <div className="login-card__header">
          <span className="login-card__tag">Entrar</span>
          <h2>Acesse sua area</h2>
          <p>Use o email e a senha cadastrados no backend local.</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
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

        <div className="login-card__footer">
          <p>
            Dica de desenvolvimento: admin padrao <strong>admin@empresa.com</strong> com senha
            <strong> 123456</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

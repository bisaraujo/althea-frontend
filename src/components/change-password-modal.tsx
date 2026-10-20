import { type FormEvent, useState } from 'react';

import { ApiError, request } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { useToast } from './toast';
import { Modal } from './ui';

const MIN_LENGTH = 10;

/** A propria pessoa troca a senha. Tambem e o caminho para sair da senha provisoria recebida por e-mail. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token, updateUser } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setCurrent(''); setNext(''); setConfirm(''); setError(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_LENGTH) return setError(`A nova senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
    if (next !== confirm) return setError('A confirmação não bate com a nova senha.');
    if (!token) return;
    setSaving(true); setError(null);
    try {
      await request<{ message: string }>('/auth/change-password', {
        token, method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      updateUser({ must_change_password: false });
      toast.success('Senha alterada.');
      setSaving(false);
      close();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Não foi possível trocar a senha.');
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Trocar senha" description={`Use pelo menos ${MIN_LENGTH} caracteres.`} size="sm"
      footer={<>
        <button type="button" className="secondary-button" onClick={close} disabled={saving}>Cancelar</button>
        <button type="submit" form="change-password-form" className="primary-button" disabled={saving || !current || !next || !confirm}>{saving ? 'Salvando...' : 'Salvar senha'}</button>
      </>}>
      <form id="change-password-form" className="admin-form" onSubmit={(event) => void submit(event)}>
        <label><span>Senha atual</span><input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required /></label>
        <label><span>Nova senha</span><input type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} minLength={MIN_LENGTH} required /></label>
        <label><span>Confirme a nova senha</span><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}

import '../pages/companies-admin.css';

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function tone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 5;
  return hash;
}

/** Não existe logotipo no cadastro da empresa: o avatar usa as iniciais. */
export function CompanyAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span className={`ca-avatar ca-avatar--${size} ca-avatar--tone${tone(name)}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

type BrandLockupProps = {
  compact?: boolean;
  tone?: 'dark' | 'light';
  subtitle?: string;
};

export function BrandLockup({
  compact = false,
  tone = 'dark',
  subtitle = 'Plataforma de jornada psicossocial',
}: BrandLockupProps) {
  return (
    <div className={`brand-lockup brand-lockup--${tone} ${compact ? 'brand-lockup--compact' : ''}`}>
      <span className="brand-lockup__mark" aria-hidden>
        <img src="/brand/favicon.svg" alt="" />
      </span>
      <span className="brand-lockup__copy">
        <strong>
          <span>turi</span>
        </strong>
        {!compact ? <small>{subtitle}</small> : null}
      </span>
    </div>
  );
}

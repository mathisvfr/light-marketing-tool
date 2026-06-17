const ROLE_BADGE = {
  owner: { background: 'var(--light-red-100)', color: 'var(--light-red-700)', label: 'Owner' },
  recruiter: { background: '#e0f2fe', color: '#075985', label: 'Recruiter' },
  viewer: { background: '#f1f5f9', color: '#334155', label: 'Viewer' },
};

export default function Header({ pageTitle, userName, role, onLogout }) {
  const badge = ROLE_BADGE[role] || { background: '#f1f5f9', color: '#334155', label: role || 'onbekend' };

  return (
    <header
      className="app-header"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <div className="app-header-title">
        <p style={{ margin: 0, color: '#475569', fontSize: '.875rem' }}>Overzicht</p>
        <h1 style={{ margin: '.15rem 0 0', fontSize: '1.3rem' }}>{pageTitle}</h1>
      </div>

      <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ display: 'block' }}>{userName}</strong>
          <span
            style={{
              display: 'inline-block',
              marginTop: '.15rem',
              padding: '.2rem .55rem',
              borderRadius: 999,
              background: badge.background,
              color: badge.color,
              fontSize: '.75rem',
              textTransform: 'capitalize',
              fontWeight: 600,
            }}
          >
            {badge.label}
          </span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 8,
            padding: '.45rem .9rem',
            font: 'inherit',
            fontWeight: 600,
            fontSize: '.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: '#ffffff',
            color: 'var(--light-red)',
            border: '1.5px solid var(--light-red-300)',
            transition: 'background .15s, border-color .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--light-red-50)';
            e.currentTarget.style.borderColor = 'var(--light-red)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.borderColor = 'var(--light-red-300)';
          }}
        >
          Uitloggen
        </button>
      </div>
    </header>
  );
}

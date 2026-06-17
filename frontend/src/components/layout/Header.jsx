export default function Header({ pageTitle, userName, role, onLogout }) {
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
              padding: '.2rem .5rem',
              borderRadius: 999,
              background: '#e0f2fe',
              color: '#075985',
              fontSize: '.75rem',
              textTransform: 'capitalize',
              fontWeight: 600,
            }}
          >
            {role || 'onbekend'}
          </span>
        </div>

        <button type="button" onClick={onLogout}>
          Uitloggen
        </button>
      </div>
    </header>
  );
}

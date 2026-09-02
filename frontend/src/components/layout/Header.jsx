import RoleBadge from '../shared/RoleBadge';
import '../shared/status-strip.css';

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
          <div style={{ marginTop: '.15rem' }}>
            <RoleBadge role={role} />
          </div>
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

export default function PageWrapper({ title, children }) {
  return (
    <section className="app-page-wrapper" style={{ padding: '1rem 1.25rem' }}>
      <div
        className="app-page-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '1rem 1.25rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

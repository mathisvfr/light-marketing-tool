export default function PageWrapper({ children }) {
  return (
    <section className="app-page-wrapper">
      <div className="app-page-card">
        {children}
      </div>
    </section>
  );
}

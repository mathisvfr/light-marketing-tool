const NAV_ITEMS = ['nav.home', 'nav.diensten', 'nav.over_ons', 'nav.vacatures', 'nav.blog', 'nav.contact'];

export default function NavPreview({ getValue }) {
  return (
    <div className="wtp-nav">
      <div className="wtp-nav-bar">
        <div className="wtp-nav-logo" />
        <div className="wtp-nav-links">
          {NAV_ITEMS.map((key) => (
            <span key={key} className="wtp-nav-link">{getValue(key) || key.split('.')[1]}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const SEO_PAGES = [
  { key: 'meta.home', page: 'Homepage' },
  { key: 'meta.diensten', page: 'Diensten' },
  { key: 'meta.over_ons', page: 'Over ons' },
  { key: 'meta.contact', page: 'Contact' },
  { key: 'meta.vacatures', page: 'Vacatures' },
  { key: 'meta.blog', page: 'Blog' },
];

export default function SeoPreview({ getValue }) {
  return (
    <div className="wtp-seo">
      {SEO_PAGES.map(({ key, page }) => {
        const desc = getValue(key) || 'Meta-beschrijving...';
        const len = (getValue(key) || '').length;
        return (
          <div key={key} className="wtp-seo-result">
            <div className="wtp-seo-url">lightpersoneelsdiensten.nl/{page === 'Homepage' ? '' : page.toLowerCase().replace(/\s+/g, '-')}</div>
            <div className="wtp-seo-title">{page} - Light Personeelsdiensten</div>
            <div className={`wtp-seo-desc${len > 160 ? ' over' : ''}`}>{desc}</div>
          </div>
        );
      })}
    </div>
  );
}

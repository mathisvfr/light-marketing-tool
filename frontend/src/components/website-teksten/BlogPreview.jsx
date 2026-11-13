export default function BlogPreview({ getValue }) {
  return (
    <div className="wtp-blog">
      <h3 className="wtp-blog-title">{getValue('blog.title') || 'Blog'}</h3>
      <p className="wtp-blog-intro">{getValue('blog.intro') || 'Introductietekst'}</p>
      <div className="wtp-blog-cards">
        <div className="wtp-blog-card">
          <div className="wtp-blog-thumb" />
          <div className="wtp-blog-card-text">
            <div className="wtp-blog-card-title" />
            <div className="wtp-blog-card-excerpt" />
          </div>
        </div>
        <div className="wtp-blog-card">
          <div className="wtp-blog-thumb" />
          <div className="wtp-blog-card-text">
            <div className="wtp-blog-card-title" />
            <div className="wtp-blog-card-excerpt" />
          </div>
        </div>
      </div>
    </div>
  );
}

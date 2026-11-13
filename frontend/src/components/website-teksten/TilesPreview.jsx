export default function TilesPreview({ getValue }) {
  const tiles = [
    { title: 'tiles.tile1_title', body: 'tiles.tile1_body' },
    { title: 'tiles.tile2_title', body: 'tiles.tile2_body' },
    { title: 'tiles.tile3_title', body: 'tiles.tile3_body' },
  ];

  return (
    <div className="wtp-tiles">
      {tiles.map((tile, i) => (
        <div key={i} className="wtp-tile-card">
          <div className="wtp-tile-icon" />
          <h4 className="wtp-tile-title">{getValue(tile.title) || `Tegel ${i + 1}`}</h4>
          <p className="wtp-tile-body">{getValue(tile.body) || 'Beschrijving'}</p>
        </div>
      ))}
    </div>
  );
}

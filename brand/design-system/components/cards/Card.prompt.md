**Card** — generic white content surface with optional image header. Use for service tiles, content blocks, and as the base for domain cards.

```jsx
<Card image="/photo.jpg" interactive>
  <h3 className="light-h3">Zakelijke diensten</h3>
  <p className="light-body">Persoonlijk advies dat aansluit bij uw bedrijf.</p>
</Card>
```

`interactive` adds hover lift, image zoom and a faint red border — use it for clickable tiles. `padding` defaults to 24px (use 20 for denser cards, 32 for hero cards).

**JobCard** — the signature vacancy listing card. Use anywhere vacancies appear (homepage feed, vacancy index, related jobs).

```jsx
<JobCard
  title="Meewerkend chauffeur"
  image="/truck.jpg"
  category="Logistiek"
  location="Rotterdam"
  hours="Fulltime"
  teaser="Ben je graag onderweg en wil je dit combineren met je nieuwe baan?"
  readTime="1,2 min"
  onClick={...}
/>
```

`category` (`Productie | Logistiek | Schoonmaak`) selects the pill icon. Requires Lucide — call `lucide.createIcons()` after mount. Built on top of `Card`.

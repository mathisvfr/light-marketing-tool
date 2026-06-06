**Tag** — neutral chip for filters and keywords (e.g. vacancy filters: "Rotterdam", "Fulltime"). Use `selected` for active filters, `removable` for applied filters.

```jsx
<Tag selected onClick={...}>Productie</Tag>
<Tag removable onRemove={...}>Rotterdam</Tag>
```

Removable tags need Lucide (`lucide.createIcons()`).

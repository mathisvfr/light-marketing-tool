**Select** — native dropdown styled to match Input. Use for category/branch pickers in forms and vacancy filters.

```jsx
<Select label="Vakgebied" options={['Productie','Logistiek','Schoonmaak']} />
<Select label="Locatie" options={[{value:'rdam',label:'Rotterdam'}]} />
```

Chevron uses Lucide — call `lucide.createIcons()` after render.

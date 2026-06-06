**Input** — labelled text field. Use in contact and application forms. Red focus ring matches the brand.

```jsx
<Input label="Naam" placeholder="Voor- en achternaam" required />
<Input label="E-mail" type="email" icon="mail" hint="Wij reageren binnen 1 werkdag." />
<Input label="Telefoon" icon="phone" error="Vul een geldig nummer in." />
```

Icons/hints are optional; pass `error` to turn the field red. Leading icons need Lucide.

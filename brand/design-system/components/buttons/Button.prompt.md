**Button** — the brand's action control; use for primary CTAs ("Lees meer", "Bekijk vacatures"), form submits, and inline links-as-buttons.

```jsx
<Button variant="primary" iconRight="arrow-right">Lees meer</Button>
<Button variant="outline">Neem contact op</Button>
<Button variant="primary" notch size="lg" icon="send">Solliciteer direct</Button>
```

Variants: `primary` (brand red, red glow on hover), `secondary` (dark grey), `outline` (red border), `ghost` (text-only). Sizes `sm | md | lg`. Set `notch` for the logo's cut-corner look on hero CTAs. Icons are Lucide names — call `lucide.createIcons()` after render. No scale-shrink on press; it darkens instead.

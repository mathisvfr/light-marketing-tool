# Tool-brede UX Cleanup — Research Pass

Companion-document bij `tool-wide-ux-cleanup.md`. Bevat de ruwe
file:line-bevindingen uit de research-ronde (Explore agent,
2026-09-02) over álle pagina's in `frontend/src/pages/`.

Hieronder de key evidence per pagina + tool-brede observaties. Zie
`tool-wide-ux-cleanup.md` voor het voorstel dat hierop bouwt.

---

## Pagina's — status per stuk

### 1. VacaturePlaatsen.jsx (opgeschoond in vorige plan-ronde)
- 4-sectie structuur (`:558`, `:618`, `:702`, `:766`) ✓
- Chip-cluster talen-checkboxes (`:769-800`) ✓
- StatusBadge (`:822`) ✓, StatusStrip (`:825-866`) ✓, StickyFooter (`:1031-1050`) ✓
- **Blijvend punt**: autosave-indicator staat zowel bovenaan (`:548-555`)
  als in sticky footer — dubbele info. (Ligt buiten deze plan-ronde
  tenzij reviewer aandringt.)

### 2. MarketingPost.jsx (opgeschoond in vorige plan-ronde)
- Zelfde primitives als VacaturePlaatsen ✓
- **Nieuw punt**: PatternPickerBlock (`:814-910`) is 100-regels owner-
  only inline component. Kandidaat voor extractie als we een tweede
  scheduling-use-case krijgen (nu niet in scope).

### 3. Dashboard.jsx
- StatusBadge gebruikt in approval-queue (`:218`) en recent-activity
  (`:260`) sinds recente commit ✓
- **Kaart-CSS** `dashboard-card` eigen aan deze pagina — kandidaat
  voor `<Card>` (F1.1).
- **Row-actions** approve/reject (`:221-237`) inline vs. ContentWachtrij
  bulk-bar — geen shared button-group patroon.
- **Kanaalstatus-dots** (`:277`) eigen CSS `.status-dot success/pending/
  failed` — kandidaat voor StatusBadge-uitbreiding (F1.2).

### 4. ContentWachtrij.jsx (deels bijgewerkt)
- StatusBadge in tabel-rij (`:519`) ✓ (recente commit)
- **Bulk-action-bar** (`:393-458`) — 65 regels conditionele logica per
  status. Kandidaat voor `useBulkActions` hook of blijven inline.
- **Filter-toolbar** (`:346-391`) — 45 regels inline. Kandidaat voor
  `<FilterBar>` (F3.2).
- **Row-actions** (`.queue-actions`, `:524`) inline — kandidaat voor
  `<ActionButtonGroup>` (F2.2).

### 5. Gepubliceerd.jsx
- **Hardcoded status-badge** (`:357`): `<span className="published-badge
  status-active">` — moet `<StatusBadge status="actief" />`.
- **Kanaal-status-dots** (`:278`, `:314`) eigen `getStatusDotClass`
  (`:58-76`) — moet StatusBadge met channel-tones.
- **Reschedule-modal** (`:244-280`) inline — kandidaat voor `<Modal>`
  (F2.1).
- **DateTime-util** `isoToLocalInput` (`:81-97`) gedupliceerd met
  MarketingPost PatternPickerBlock (`:839-854`) — kandidaat voor
  consolidatie (F2.5).

### 6. MerkInstellingen.jsx
- **Integration-pills** (`:244-247`) eigen styling — moet StatusBadge
  met integration-tones (F1.2).
- Verder simpele pagina — vooral Card-adoptie nodig (F1.1).

### 7. Gebruikers.jsx
- **Rol-pill** (`:158`) eigen `.role-pill owner/recruiter/viewer` —
  kandidaat voor StatusBadge-role-tone of aparte `<RoleBadge>`.
- **Create-user modal** (`:187-251`) inline — kandidaat voor `<Modal>`
  (F2.1).
- Table row-actions kandidaat voor `<ActionButtonGroup>` (F2.2).

### 8. Kalender.jsx
- Speciaal visueel component (7-koloms grid). Weinig deling met andere
  pagina's, maar filter-toolbar (`:134-158`) past bij `<FilterBar>`
  (F3.2).
- **Channel-labels + classes** (`:9-10`) — kandidaat voor bestaande
  `ChannelIndicator.jsx`.

### 9. Publicatiepatronen.jsx
- Form-card + tabel — kandidaat voor `<Card>` (F1.1).
- **Weekday-chip-toggle** (`:177-190`) vergelijkbaar met talen-chips
  in VacaturePlaatsen — geen shared component, maar afzonderlijke
  use-case (niet in scope).

### 10. SeoPaginas.jsx ⚠️ CRITICAL
- **Mixed design system**: importeert `@/components/ui/` (Card,
  Button, Input, Tabs, Table, Textarea, Label). File is 300+ regels
  half-af Shadcn-migratie.
- Importeert StatusBadge (`:7`) uit shared — dubbele adressering.
- **Fix in F1.3**: alles terug naar plain-CSS + shared primitives.

### 11. Login.jsx ⚠️ CRITICAL
- Ook Shadcn: `Card`, `Button`, `Input`, `Label`.
- **Fix in F1.3**: terug naar plain-CSS + shared primitives.

---

## Layout-shell (AppShell / Header / Sidebar)

### AppShell.jsx
- Sidebar + main content layout in CSS-in-JS (inline styles `:7-64`).
- `maxWidth: 280` hardcoded, geen tokens.
- Nav-items met owner-only filter — logic OK, styling niet consistent.

### Header.jsx
- Role-badge inline styling, hardcoded kleuren (`light-red-100` naast
  `#e0f2fe`) — niet aligned met StatusBadge-tones.
- Kandidaat voor StatusBadge-role-tone (F3.1) of custom `<RoleBadge>`.

### Sidebar
- Inline styles, "LP"-circle branding hardcoded.
- CSS-in-JS met hardcoded kleuren — kandidaat voor `layout.css` (F3.1).

---

## Shared components — huidige status

| Component | File | Gebruikt in | Status |
|-----------|------|-------------|--------|
| StatusBadge | `shared/StatusBadge.jsx` | Vacature, Marketing, Dashboard, ContentWachtrij, SeoPaginas | Compleet, uitbreiding nodig voor channel/integration/role tones |
| StatusStrip | `shared/StatusStrip.jsx` | Vacature, Marketing | Compleet, geen tool-brede uitbreiding nodig |
| StickyFooter | `shared/StickyFooter.jsx` | Vacature, Marketing | Compleet, kan hergebruikt in modals |
| FormMessage | `shared/FormMessage.jsx` | 1 plek | Beperkt gebruikt — kandidaat voor tool-brede adoptie (F2.3) |
| GenerationProgress | `shared/GenerationProgress.jsx` | Vacature, Marketing | Compleet |
| MediaPicker | `shared/MediaPicker.jsx` | Vacature, Marketing | Compleet |
| PlatformPreview | `shared/PlatformPreview.jsx` | Marketing | Compleet |
| VersionHistoryPicker | `shared/VersionHistoryPicker.jsx` | Vacature, Marketing | Compleet |
| ChannelIndicator | `shared/ChannelIndicator.jsx` | Kalender (nog niet, kandidaat) | Onder-gebruikt |
| TypeBadge | `shared/TypeBadge.jsx` | Waar? | Onder-gebruikt |
| Card | — | — | **Ontbreekt** — F1.1 |
| Modal | — | — | **Ontbreekt** — F2.1 |
| ActionButtonGroup | — | — | **Ontbreekt** — F2.2 |
| Toast | — | — | **Ontbreekt** — F2.3 |
| TabBar | — | — | **Ontbreekt** — F2.4 |
| FilterBar | — | — | **Ontbreekt** — F3.2 |

---

## Cross-cutting issues (samenvatting)

| Issue | Ernst | Betrokken pagina's | Voorgestelde fix |
|-------|-------|--------------------|--------------------|
| Design-system-fragmentatie (Shadcn vs. plain CSS) | Critical | SeoPaginas, Login | F1.3 — migratie |
| Geen shared `<Card>` | Critical | Alle 11 | F1.1 |
| Bulk-action-bar niet herbruikbaar | High | ContentWachtrij | Behoud inline of F3-extra `useBulkActions` |
| StatusBadge niet overal gebruikt | High | Gepubliceerd, MerkInstellingen, Header | F1.2 |
| Kanaal-status-dots gedupliceerd | High | Gepubliceerd, MerkInstellingen | F1.2 |
| DateTime-util gedupliceerd | High | Gepubliceerd, MarketingPost | F2.5 |
| Geen shared modal | Medium | Gebruikers, Gepubliceerd | F2.1 |
| Geen shared action-button-group | High | Dashboard, ContentWachtrij, Gepubliceerd, Gebruikers | F2.2 |
| Geen shared toast/error-styling | High | Alle | F2.3 |
| Geen shared tabbar | Medium | Vacature, Marketing, SeoPaginas | F2.4 |
| Geen shared filterbar | Medium | ContentWachtrij, Kalender | F3.2 |
| AppShell inline styles/hardcoded kleuren | Medium | Layout-shell | F3.1 |
| Mobiele tabel-overflow | Medium | Gepubliceerd, ContentWachtrij | F3.4 |
| Image-upload flow gefragmenteerd | Medium | Vacature, Marketing, Gepubliceerd | Niet in scope (component MediaPicker bestaat al; complete extraction is aparte ronde) |

---

## Wat NIET in scope zit voor deze plan-ronde

- **Storybook / component-catalogus** — waardevol maar aparte
  investering. Doet niets voor eindgebruiker.
- **A11y-audit met axe** — we passen focus-visible + aria-labels toe
  waar we toch bezig zijn, maar geen full sweep.
- **Dark mode** — geen product-vraag.
- **Onboarding-tour** — Dashboard heeft al onboarding-checklist; verder
  uitbreiden is separate feature-request.
- **Mobile-first redesign** — respect voor de "geen mobiel-first" niet-
  doel. Losse fixes waar tabellen breken (F3.4) wel.
- **Radix / Headless UI adoptie** — alleen als een 2e complexere
  primitive (Popover, Combobox) nodig wordt. Vandaag niet.
- **Weekday-chip-extraction** naar shared component — 2 use-cases
  (talen + weekdagen) is te weinig om al te generaliseren.
- **Metrics/analytics-dashboard** voor content-performance.

---

## Open onderzoek-vragen (voor plan-review)

Zie hoofdplan `tool-wide-ux-cleanup.md` sectie "Open vragen (voor
review)". Deze research heeft geen nieuwe vragen opgeleverd bovenop
de tien die daar staan.

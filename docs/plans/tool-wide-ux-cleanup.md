# Plan: Tool-brede UX opschoning

Status: DRAFT (ready for review)
Branch: `main` (implementatie op eigen feature-branches)
Author: mathisvfr (+ Claude Opus 4.7)
Date: 2026-09-02

## Probleem

De vacature-plaatsen + marketing-post pagina's zijn recent grondig opgeschoond
(`docs/plans/vacature-ux-cleanup.md`) en delen nu vier concrete conventies:
gelabelde `<section>`-blokken, chip-cluster voor multi-select, shared
`StatusBadge`/`StatusStrip`/`StickyFooter`, en gedeelde
`useImagePath`/`useCriticus` hooks. Die twee pagina's voelen nu strak.

De **overige acht pagina's** (Dashboard, ContentWachtrij, Gepubliceerd,
MerkInstellingen, Gebruikers, Kalender, Publicatiepatronen, SeoPaginas +
Login + layout-shell) hebben die conventies **niet**. Concreet zichtbaar
voor de gebruiker:

- **Design-system-fragmentatie**: SeoPaginas + Login gebruiken Shadcn-
  components (Card, Button, Input, Tabs), de rest gebruikt plain CSS per
  pagina. Font-metrics, padding, border-radius en kleuren verschillen
  tussen pagina's.
- **Card-containers**: elke pagina definieert een eigen card-achtige
  wrapper (`dashboard-card`, `integration-card`, `patronen-form-card`,
  `.users-modal`, `.published-panel`) met licht afwijkende spacing.
- **Status-taal**: `StatusBadge` bestaat maar wordt inconsistent gebruikt.
  Gepubliceerd hardcodeert een `.published-badge status-active` in plaats
  van `<StatusBadge status="actief" />`. Kanaal-status-dots
  (success/pending/failed) hebben een eigen implementatie in Gepubliceerd
  én MerkInstellingen.
- **Tabellen en bulk-acties**: elke tabel-actie is inline opnieuw
  gestyled (Dashboard vs. ContentWachtrij vs. Gepubliceerd). De
  bulk-action-bar in ContentWachtrij is 65 regels conditionele logica
  zonder herbruikbaarheid.
- **Foutmeldingen**: overal ruwe `<p className="...-error">`-tags met per
  pagina een andere klasse. Geen toast, geen visuele hiërarchie.
- **Modals**: Gebruikers en Gepubliceerd hebben elk hun eigen inline
  modal met eigen backdrop-CSS.
- **Layout-shell** (`AppShell`, `Header`, `Sidebar`): CSS-in-JS met
  hardcoded kleuren en `maxWidth`-getallen die de design-tokens
  omzeilen.
- **DateTime-conversie**: `isoToLocalInput`/timezone-logica is letterlijk
  gedupliceerd tussen Gepubliceerd en MarketingPost's PatternPickerBlock.

Volledig research-verslag met file:line-referenties: zie
`docs/plans/tool-wide-ux-cleanup-research.md`.

## Gebruikers

- **Sandra & Liza (recruiter)** — dagelijks in Dashboard, ContentWachtrij
  en de twee content-pagina's. Zien de inconsistentie het felst op
  overgangen: Dashboard-card → tabel-row → detail-pagina zonder
  gedeelde visuele taal.
- **Luke (owner)** — komt ook in MerkInstellingen, Gebruikers en
  Publicatiepatronen. Ziet Buffer-statuscards, gebruikersbeheer en
  scheduling naast elkaar — daar valt het design-verschil het meest op.
- **Alle drie** — mobiel gebruik incidenteel maar reëel. Tabellen die
  horizontaal overlopen op iPhone en modals die niet passen zijn een
  probleem dat we in deze pass proberen te beperken zonder een
  mobiel-first redesign te doen.

## Doelen

1. **Visuele consistentie** — één design-taal voor cards, buttons,
   badges, tabellen, modals, foutmeldingen. Gebruiker herkent
   patronen tussen pagina's.
2. **Herbruikbare primitives** in `components/shared/` waar dat
   substantiële duplicatie wegneemt (Card, Modal, Toast,
   ActionButtonGroup). Alleen bouwen wat we minimaal twee keer
   gebruiken.
3. **Design-system-eenheid** — Shadcn eruit op SeoPaginas + Login,
   want die twee zijn de enige uitbijters. Alles op dezelfde plain-CSS
   + tokens.
4. **Statusbadge overal** — geen hardcoded status-pills of
   channel-dots meer. Uitbreiden waar de tone-set nog niet dekt
   (kanaal-status + integration-status).
5. **Autosave/foutmelding-consistentie** — één patroon voor
   inline-feedback in plaats van per pagina een eigen `<p>` met eigen
   klasse.
6. **Geen backend-wijzigingen** — pure frontend-pass. Data-endpoints
   en prompts blijven onaangeroerd.

## Niet-doelen

- **Mobiel-first redesign.** Blijft responsive, maar de primaire
  ervaring blijft desktop. Losse mobiel-fixes waar tabellen breken zijn
  wel in scope; een aparte mobiele layout niet.
- **Nieuwe features.** Alleen herstructurering + primitives. Geen
  nieuwe filters, bulk-acties, of scheduling-flows.
- **Grote lib-migraties.** Geen introductie van Tailwind, geen switch
  naar shadcn-brede adoptie, geen React Router 7. We doen 't met wat
  er al staat.
- **Volledige refactor van AppShell/Sidebar naar componentbibliotheek.**
  CSS-in-JS wordt vervangen door tokens, maar de structuur blijft.
- **Storybook / component-catalogus.** Later evt., niet nu.
- **A11y-audit tool-breed.** We passen focus-visible + aria-labels toe
  waar we toch al bezig zijn, geen full sweep.

## Voorstel — 12 items, opgedeeld in 3 fasen

### Fase 1 — Fundament (3 items, 1 PR)

**F1.1 — Shared `<Card>` component**
- Nieuw: `components/shared/Card.jsx` + `card.css` in `styles/`.
- API: `<Card><CardHeader title="X" /><CardBody>...</CardBody></Card>`
  met tone-varianten (`neutral`, `emphasized`).
- Adopteer in Dashboard, MerkInstellingen, Gebruikers,
  Publicatiepatronen als eerste (kleine pagina's). Bestaande
  `.dashboard-card`, `.integration-card` etc. worden aliassen die
  Card-tokens overnemen tot ze verdwenen zijn.

**F1.2 — `StatusBadge` uitbreiden voor kanaal- en integration-status**
- Toevoegen aan `STATUS_META`: `channel_success`, `channel_pending`,
  `channel_failed`, `integration_connected`, `integration_expiring`,
  `integration_disconnected`.
- Vervang alle hardcoded status-pills:
  - Gepubliceerd `:357` (`.published-badge status-active`)
  - Gepubliceerd `:278`, `:314` (kanaal-status-dots)
  - MerkInstellingen `:244-247` (integratie-pills)
  - Header.jsx role-badge (nu inline styles met hardcoded kleuren)

**F1.3 — SeoPaginas + Login migreren van Shadcn naar plain-CSS**
- SeoPaginas: `Card`, `Button`, `Input`, `Textarea`, `Label`, `Tabs`,
  `Table` uit `@/components/ui/` vervangen door plain HTML +
  vacature-plaatsen-achtige CSS + shared primitives.
- Login: idem voor `Card`, `Button`, `Input`, `Label`.
- Na dit item is Shadcn nergens meer in gebruik → deps kunnen worden
  gepurged in Fase 3.

### Fase 2 — Interactie-primitives (5 items, 2 PRs)

**F2.1 — Shared `<Modal>` component (PR 2a)**
- Nieuw: `components/shared/Modal.jsx` + `modal.css`.
- Backdrop, close-on-outside-click, close-on-escape,
  focus-trap, `role="dialog"` + `aria-modal="true"`.
- Vervang inline modals in Gebruikers (create-user) en Gepubliceerd
  (reschedule).

**F2.2 — Shared `<ActionButtonGroup>` component (PR 2a)**
- Nieuw: `components/shared/ActionButtonGroup.jsx`.
- Flex-container met consistente spacing, secondary/primary variants,
  optional autosave-slot.
- Adopteer in Dashboard row-actions, ContentWachtrij row-actions,
  Gepubliceerd row-actions, Gebruikers row-actions.

**F2.3 — Shared `<Toast>` + inline `<FormMessage>` polish (PR 2b)**
- Uitbreiding van bestaande `FormMessage.jsx` component: consistente
  error/success/attention/info tones + icoontjes, non-color-only.
- Nieuw: `components/shared/Toast.jsx` voor floating notifications na
  save/publish. Auto-dismiss na 4s, `role="status"` (success) of
  `role="alert"` (error). Positie top-right, gestapeld.
- Vervang alle inline `<p className="*-error">` in Vacature, Marketing,
  ContentWachtrij, Gepubliceerd, MerkInstellingen, Gebruikers,
  Publicatiepatronen.

**F2.4 — Shared `<TabBar>` component (PR 2b)**
- Nieuw: `components/shared/TabBar.jsx`. Wrapper om huidige
  `.preview-tabs` styling + toetsenbord-nav (Arrow-left/right).
- Refactor: VacaturePlaatsen (`createLangTabs`), MarketingPost
  (kanaal-tabs), en SeoPaginas (na Shadcn-migratie in F1.3).

**F2.5 — DateTime utils consolideren (PR 2b)**
- Nieuw: `frontend/src/lib/datetime.js` — `isoToLocalInput`,
  `formatDateTime`, `formatSchedule`, `isFutureIso`, tz-helper.
- Removeer duplicates uit Gepubliceerd (`:81-97`) en MarketingPost
  PatternPickerBlock (`:839-854`).

### Fase 3 — Cleanup + AppShell (4 items, 1 PR)

**F3.1 — AppShell/Header/Sidebar naar tokens**
- Alle inline styles + hardcoded kleuren vervangen door tokens uit
  `styles/tokens/`. Layout-CSS naar aparte `layout.css`.
- Role-badge in Header wordt `<StatusBadge>` met een `role_*` tone-set.

**F3.2 — `<FilterBar>` component**
- Nieuw: `components/shared/FilterBar.jsx` — flex-container met select
  + search + optional right-slot voor actions.
- Adopteer in ContentWachtrij (`:346-391`) en Kalender (`:134-158`).

**F3.3 — Shadcn purgen**
- Verwijder `frontend/src/components/ui/` dir.
- Verwijder Shadcn/Radix deps uit package.json indien ze na F1.3 en
  F2.4 niet meer geïmporteerd zijn.
- Vermindert bundle-size en elimineert design-system-drift-risk.

**F3.4 — Mobiele table-overflow fixes**
- Gepubliceerd (3 tabellen), ContentWachtrij (grote tabel):
  horizontale scroll-container + sticky first column op mobiel.
- Geen redesign, alleen `overflow-x: auto` + `min-width` op tabellen.

## Migratiepad (concreet PR-schema)

| PR | Fase | Inhoud | Ballpark |
|----|------|--------|----------|
| PR 1 | 1 | Card, StatusBadge uitbreiden, SeoPaginas + Login migratie | 2-3 dagen human / ~3-4u CC |
| PR 2a | 2 | Modal + ActionButtonGroup + adoptie | 1-2 dagen human / ~2u CC |
| PR 2b | 2 | Toast/FormMessage + TabBar + datetime utils | 1-2 dagen human / ~2u CC |
| PR 3 | 3 | AppShell/Header tokens + FilterBar + Shadcn purge + table-overflow | 1-2 dagen human / ~2u CC |

Iedere PR staat op eigen branch, is los te previewen, en heeft geen
backend-koppeling. Totale doorlooptijd: ~1.5 week met kalender-ruimte
voor previews en design-tweaks.

## Detail: shared componenten API

**`<Card>`** — één component, twee slots:
```jsx
<Card tone="neutral">                        {/* of "emphasized" */}
  <CardHeader title="Gebruikers" action={<Button>Toevoegen</Button>} />
  <CardBody>{children}</CardBody>
</Card>
```

**`<Modal>`** — controlled, backdrop, escape-close:
```jsx
<Modal open={isOpen} onClose={() => setOpen(false)} title="Gebruiker toevoegen">
  {formContent}
  <ActionButtonGroup>
    <Button variant="secondary" onClick={onClose}>Annuleren</Button>
    <Button variant="primary" onClick={onSubmit}>Toevoegen</Button>
  </ActionButtonGroup>
</Modal>
```

**`<ActionButtonGroup>`** — flex-row met consistente gaps, wrappt op
smalle viewports:
```jsx
<ActionButtonGroup>
  <Button variant="secondary" onClick={onCancel}>Annuleren</Button>
  <Button variant="primary" onClick={onApprove}>Goedkeuren</Button>
</ActionButtonGroup>
```

**`<Toast>`** — imperative API via context:
```jsx
const toast = useToast();
toast.success('Concept opgeslagen');
toast.error('Publiceren mislukt: ...');
```

**`<TabBar>`** — controlled:
```jsx
<TabBar
  value={activeTab}
  onChange={setActiveTab}
  tabs={[
    { key: 'nl', label: 'Nederlands' },
    { key: 'pl', label: 'Pools', pending: true },
  ]}
/>
```

**`<FilterBar>`** — slot-based:
```jsx
<FilterBar>
  <FilterBar.Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
  <FilterBar.Search value={query} onChange={setQuery} placeholder="Zoeken..." />
  <FilterBar.Actions>{bulkActions}</FilterBar.Actions>
</FilterBar>
```

## Open vragen (voor review)

Deze zijn zaken waar het codepad geen richting geeft; input van
reviewers gewenst.

1. **Nieuwe `<Button>` component of blijven bij plain HTML `<button>` +
   CSS-klasse?** Voorstel: Button-component met `variant` + `size` +
   `disabled` props. Reduceert padding/font-weight inconsistencies.
   Kost extra scope in Fase 1.

2. **Toast-system: eigen context of library?** Voorstel: eigen simpele
   provider (context + reducer + auto-dismiss timer). Geen `react-hot-
   toast` of `sonner` — te veel deps voor 3 toasts per pagina.

3. **Modal-focus-trap zelf implementeren of Radix `Dialog` importeren?**
   Voorstel: zelf implementeren met `inert` polyfill (~40 regels).
   Radix Dialog importeren = terug naar mixed-design-systeem. Als de
   focus-trap edge-cases moeilijk blijken, kunnen we alsnog Radix
   overwegen voor alleen die primitive.

4. **Card-tones: `neutral` + `emphasized` genoeg, of extra `warning`/
   `danger`?** Voorstel: alleen `neutral` en `emphasized` in F1.
   Warning/danger = via Toast + inline FormMessage. Card-tones zijn
   voor visuele grouping, niet voor status.

5. **SeoPaginas Tabs migratie: tabbladen voor "concept/gepubliceerd" of
   een filter-select?** Voorstel: gebruik nieuwe `<TabBar>`. Consistent
   met VacaturePlaatsen/MarketingPost patroon.

6. **AppShell layout: sidebar collapsible op tablet?** Voorstel: nee.
   Blijft altijd zichtbaar op desktop; op mobiel hamburger-menu dat
   over content valt. Al bestaande gedrag.

7. **ContentWachtrij bulk-action-bar: extractie naar hook of naar
   component?** Voorstel: hook (`useBulkActions`) omdat de UI-shape
   status-afhankelijk sterk verschilt. Component zou te veel branches
   krijgen.

8. **DateTime tz-handling: server-side Europe/Amsterdam of client-
   timezone?** Voorstel: alles in Europe/Amsterdam (staat al in
   `date-fns-tz` in backend). Client toont hetzelfde. Voorkomt DST-
   verrassingen tussen pagina's.

9. **Modal: sluiten via backdrop-click ja/nee?** Voorstel: ja, tenzij
   het een form-modal met unsaved changes is. Handmatig confirmen bij
   Gebruikers create-form.

10. **Foutmeldingen: inline én toast, of exclusief?** Voorstel: inline
    voor validation-errors (naast het veld), toast voor
    action-failures (na klik op knop). Beide tegelijk = te veel signaal.

## Risico's

- **Scope creep naar componentbibliotheek.** Iedere primitive is een
  klein product. Bewaak dat Card/Modal/Toast/etc. dun blijven en
  alleen doen wat we vandaag nodig hebben. Uitbreidbaarheid komt
  vanzelf op basis van tweede use-case.
- **SeoPaginas-migratie kan tegenvallen** als de Shadcn Tabs of Table
  functionaliteit gebruikt die we onderschatten. Backup-plan: laat
  SeoPaginas als enige uitbijter, migreer alleen Login.
- **Toast + FormMessage overlap** kan verwarrend zijn. Duidelijk
  documenteren in Card/Modal/Toast usage-guide (README in
  components/shared/).
- **AppShell-refactor kan de sidebar-navigatie kort breken.** Test
  alle rol-varianten (owner, recruiter, viewer) voor merge.
- **CSS-specificiteit-conflicten** wanneer we oude klassen (bijv.
  `.dashboard-card`) laten leven naast nieuwe `<Card>`. Voor Fase 1
  aliasen naar dezelfde tokens, in Fase 3 oude klassen verwijderen.
- **Regressies in autosave-flow van form-pagina's** wanneer we naar
  `<Toast>` migreren. VacaturePlaatsen + MarketingPost hebben net een
  autosave-loop-fix gehad; hier voorzichtig zijn.

## Buiten scope (aparte plan-rondes later)

- Storybook / interactieve componentcatalogus.
- A11y-audit met axe of manual testing.
- Dark mode.
- Onboarding-tour voor nieuwe recruiters.
- Metrics-dashboard voor content-performance (Buffer stats etc.).
- Full mobile-first redesign.
- Radix / Headless UI adoptie voor complexere primitives (Popover,
  Combobox, DatePicker) — komt terug als we een tweede use-case
  vinden.
- Backend-side status normalisatie (bijv. `pending_approval` →
  `ingediend` in DB). We doen alleen frontend-labels.

## Success-indicatoren (na PR 3)

- Alle status-pills in de app komen uit één `<StatusBadge>`.
- Geen import van `@/components/ui/` meer in codebase.
- Iedere pagina gebruikt `<Card>` voor primaire content-containers.
- Foutmeldingen komen uit `<Toast>` of `<FormMessage>`, geen raw `<p>`.
- Bundle-size van frontend daalt na Shadcn/Radix purge.
- Nieuwe pagina bouwen kan met alleen `<Card>` + `<TabBar>` + `<Toast>`
  + `<StatusBadge>` — geen page-specifieke CSS meer voor gedeelde
  patronen.

---

# GSTACK REVIEW REPORT

Status: `/autoplan` completed 2026-09-02.
Dual voices: **[subagent-only]** — Codex niet geïnstalleerd. Primary Claude-subagent + parent-synthesis als tweede voice per fase.
DX phase: **skipped** — interne recruiter-tool, geen devtool.

## Phase 1 — CEO Review (Strategy & Scope)

**Verdict**: Ship met revisions — 30-40% te breed voor 3-4 gebruikers.

### CEO Consensus Table

| # | Dimension | Voice A | Voice B | Consensus |
|---|-----------|---------|---------|-----------|
| 1 | Premises valid? | 4 valid, 6 aangenomen (visuele consistentie voor 3-4 users) | Agree | Aangenomen |
| 2 | Right problem? | Debatable — plan levert 0 product-vooruitgang; koopt polish | Agree | Debatable |
| 3 | Scope-calibratie? | Nee — PR1 en PR3 zijn te breed, PR3 grab-bag | Agree | Off |
| 4 | Alternatieven onderzocht? | Nee — "Shadcn adopteren" niet overwogen | Agree | Partial |
| 5 | 6-maanden regret? | Weken werk zonder feature-uplift | Agree | Reëel |
| 6 | 1.5 week doorlooptijd? | Optimistisch — realistisch 2-3 weken kalender | Agree | Optimistisch |

### CEO Findings (top 10)

1. **[High]** Shadcn-purge is contra-directioneel — SeoPaginas is "half-af Shadcn-migratie", logische conclusie is doortrekken niet terug.
2. **[High]** DashboardCharts + TypeBadge + FormMessage worden vergeten in "Shadcn nergens meer" claim.
3. **[High]** Zelf-focus-trap-bouwen is klassieke onderschatting — Radix Dialog al in deps.
4. **[High]** Geen user-interview vóór go — hele plan gebouwd op aanname "consistentie is nu het pijnpunt" zonder data.
5. **[Medium]** 1.5 week doorlooptijd is optimistisch bij 4 PRs + reviews.
6. **[Medium]** Bundle-size als success-indicator is een non-metric voor interne tool.
7. **[Medium]** Autosave-indicator dubbel in VP wordt bewust buiten scope gehouden — precies wat UX-consistentie plan moet doen.
8. **[Medium]** useBulkActions hook = "primitives voor primitives" — 1 use-case.
9. **[Medium]** Backend status-normalisatie skippen betekent elke nieuwe consumer opnieuw mapt.
10. **[Medium]** Toast + FormMessage boundary wegschuiven naar implementatie.

## Phase 2 — Design Review (UX/UI)

**Verdict**: Ship met revisions — 3 substantiële ambiguities + missing states.

### Design Litmus Scorecard

| Dim | Score | Justificatie |
|-----|-------|--------------|
| Information hierarchy | 6/10 | Primitives matchen code, geen visuele hiërarchie per pagina uitgewerkt |
| Missing states | 4/10 | 33/35 states-cellen niet gespecificeerd |
| Emotional arc | 5/10 | Doel impliciet, geen owner/recruiter divergence |
| Specificity | 5/10 | Tokens bestaan, geen concrete padding/type per primitive |
| Design system coherence | 7/10 | Zes primitives 80% juist; ontbreekt Button, EmptyState, PageHeader |
| Accessibility | 6/10 | Modal-a11y sterk; reduced-motion/contrast ontbreken |
| Interaction affordances | 7/10 | JSX-snippets duidelijk; TabBar array-API te rigide |

### Design Findings (top 10)

1. **[High]** 33/35 primitive-states niet gespec'd — tijdbom voor implementatie.
2. **[High]** StatusBadge risico op semantiek-overload — split in StatusBadge + ChannelStatus + RoleBadge.
3. **[High]** Toast/FormMessage/Banner boundary onduidelijk — 3-tier contract nodig.
4. **[Medium]** Card mist padding-scale, footer-slot, loading/empty states.
5. **[Medium]** Modal mist size-varianten en mobiel-verhaal (fullscreen op mobile?).
6. **[Medium]** Toast auto-dismiss 4s onveilig voor errors — moet persistent tot dismiss.
7. **[Medium]** TabBar tabs-array API breekt bij badges/counts — kies children-based.
8. **[Medium]** ActionButtonGroup zonder Button-primitive levert weinig — koppel of schrap.
9. **[Medium]** Emphasized Card niet visueel gedefinieerd — 3 developers = 3 interpretaties.
10. **[Medium]** Bulk-action-bar zou 7e primitive moeten zijn (visueel-cruciaal).

## Phase 3 — Eng Review (Architecture & Tests)

**Verdict**: **REFRAME** — F1.3 + F3.3 zijn engineering-wrong door Tailwind-onderschatting.

### Eng Consensus Table

| # | Dimension | Voice A | Voice B | Consensus |
|---|-----------|---------|---------|-----------|
| 1 | Architecture sound? | 80% ja, ontbreekt DataTable + ConfirmDialog | Agree | Partial |
| 2 | Test coverage sufficient? | 6 must-have listed, nice-to-haves 3 | Agree | Adequate |
| 3 | Performance risks? | Toast provider re-render, timer leaks | Agree | Beheersbaar |
| 4 | Security threats? | Frontend-only, geen nieuwe auth-surface | N/A | N/A |
| 5 | Error paths handled? | Toast provider MOET in ErrorBoundary | Agree | Kritisch |
| 6 | Deployment risk? | PR 3 = landmijn (Tailwind purge, DashboardCharts) | Agree | HIGH |

### Kritieke Eng Bevindingen

- **Tailwind zit DIEP in codebase**: `index.css:186-206` `@layer base { * { @apply border-border outline-ring/50 } }` — verwijderen breekt globale border-defaults. DashboardCharts, TypeBadge, FormMessage, MediaPicker gebruiken Tailwind-classes. VacaturePlaatsen en MarketingPost óók (3 en 1 occurrence).
- **"Plain CSS" is niet het bestaande patroon** — plan verwart Shadcn (`components/ui/*`) met Tailwind. Shadcn-map + Radix + CVA kunnen weg; Tailwind is aparte, veel grotere migratie.
- **Modal via Radix Dialog** — `@radix-ui/react-dialog` staat al in `package.json:16`, wordt al gebruikt door `components/ui/dialog.jsx:111`. Zelf `inert`-polyfill schrijven is een 2-weken tar-pit voor focus-trap edge-cases in nested selects, iframes, portals.
- **7× `window.confirm()`** op destructieve acties (Gp, CW, SEO) — ontbreekt in plan als `<ConfirmDialog>` primitive.

### Eng Failure Modes

| Scenario | Current | New (planned) | Severity |
|----------|---------|---------------|----------|
| Toast provider crasht | n/a | Hele app onbruikbaar (React 19 error-boundary bubbles) | High — MOET ErrorBoundary |
| Shadcn-purge verwijdert `@radix-ui/react-slot` | Werkt | Runtime crash bij `asChild` gebruik | High |
| Tailwind `border-border` verdwijnt | Werkt | Elke `<div>` verliest border-defaults → app-brede regressie | **CRITICAL** |
| DashboardCharts (Shadcn) niet gemigreerd | Werkt | Build breekt bij purge | High |
| SeoPaginas mid-generation tijdens deploy | Klaar in 30s | 404 op nieuwe bundle | Medium |

## Cross-Phase Themes (User Challenges)

Meerdere voices onafhankelijk pushten terug op dezelfde beslissingen — high-confidence signalen:

### UC1 — Shadcn-purge richting
- CEO: "adopteren i.p.v. eruit slopen"
- Design: "F1.3 is juist maar underestimate scope; begin met Login, evalueer, dan SeoPaginas"
- Eng: "Shadcn ui/*-map + Radix + CVA weg kan; Tailwind moet BLIJVEN — het zit in globale @layer base"
- **Consensus**: Plan-as-written mixt Shadcn en Tailwind ten onrechte. Beslis: (a) alleen `components/ui/*` verwijderen, Tailwind behouden, of (b) Shadcn tool-breed adopteren, of (c) huidige koers vasthouden met significante scope-uitbreiding.

### UC2 — Modal: Radix Dialog vs zelf-bouwen
- CEO: "Radix Dialog gebruiken, het staat er al — kost 1 uur i.p.v. focus-trap-tar-pit"
- Design: bevestigt kwaliteit van Radix Dialog impliciet
- Eng: "Focus-trap in iframes en nested combos is een 2-weken tar-pit; niet doen"
- **Consensus**: Gebruik Radix Dialog achter een branded wrapper. Bespaart weken werk en garandeert a11y.

### UC3 — TabBar en FilterBar als primitives skippen
- CEO: "TabBar = 3 use-cases, FilterBar = 2. Onder de 'gebruik minimaal 3 keer'-regel — uitstellen"
- Design: "TabBar array-API breekt bij badges"
- Eng: "Skip beide tot 4e use-case; extractie is meer werk dan 3× kopiëren"
- **Consensus**: Schrap TabBar (F2.4) en FilterBar (F3.2) uit deze plan-ronde.

### UC4 — StatusBadge splitsen i.p.v. uitbreiden
- CEO: "16+ tone-entries in één component is een lek in de abstractie"
- Design: "draft-lifecycle, channel-health, role-identity zijn verschillende categorieën — splits in 3 componenten"
- Eng: (impliciet via warning over API-drift)
- **Consensus**: `<StatusBadge>` blijft voor draft-lifecycle. Nieuwe `<ChannelStatus>` (kan `ChannelIndicator.jsx` uitgroeien) voor kanaal-health. Nieuwe `<RoleBadge>` (of `TypeBadge.jsx` uitbreiden) voor identiteit.

### UC5 — 15-min gesprek met Sandra/Luke vóór go
- CEO: "Bel Sandra of Luke. Vraag 'waar loop je nu tegenaan?'. Als antwoord 'de app is inconsistent' → doorgaan. Als 'ik wil dat de tool suggesties geeft' → dit plan pauzeren."
- **Cost of skipping**: 1.5-3 weken werk op de verkeerde prioriteit terwijl feature-vragen wachten.

### UC6 — Backend status-normalisatie er wel bij
- CEO: "Skippen is short-term-thinking — 2u backend-fix, dan is `STATUS_META` één API-call"
- **Consensus**: Voeg backend `/api/meta/statuses` endpoint toe (out-of-scope in origineel plan).

### UC7 — Autosave-indicator dubbel in VP fixen
- CEO: "Precies wat UX-consistentie-plan moet doen — 30-min fix in PR 2a"
- **Consensus**: Neem dit in scope.

## Auto-decisions (P1-P5 principles)

| # | Decision | Principle | Rationale |
|---|----------|-----------|-----------|
| 1 | Card krijgt `<CardFooter>`, `padding` prop (sm/md/lg), loading/empty compound-components | P1 (complete) | Design-findings #4 — huidige plan is te dun |
| 2 | Card "emphasized" definieren als `border-top: 3px solid var(--color-primary)` (echo logo-notch DNA) | P5 (explicit) | 3 devs = 3 interpretaties anders |
| 3 | Modal krijgt `size` prop (sm/md/lg) + mobile-fullscreen boven bepaalde breakpoint | P1 | Design-finding #5 |
| 4 | Toast errors persistent tot dismiss, success 4s auto-dismiss | P1 | Design-finding #6 |
| 5 | Toast max 3 stapelen, `toast.promise()` pattern voor async | P1 | Voor Buffer-post 2-4s calls |
| 6 | `<ToastProvider>` altijd wrappen in `<ErrorBoundary>` | P1 | Eng-critical failure mode |
| 7 | TabBar children-based API i.p.v. array-prop | P5 | Design-finding #7 — flexibeler |
| 8 | ConfirmDialog toevoegen als 7e primitive | P1 | 7× window.confirm() = zichtbaarste UX-fragmentatie |
| 9 | DateTime utils F2.5 vóór F2.1 doen | P3 (pragmatic) | Valideert "shared lib"-tooling zonder scope-risico |
| 10 | Autosave-indicator dubbel in VP fixen in F2 | P2 (boil lakes) | Cross-phase agreement |
| 11 | Missing-states matrix per primitive verplichte pre-work | P1 | Design-finding #1 — anders tijdbom |
| 12 | Reduced-motion guards op Modal/Toast animaties | P1 | A11y baseline |
| 13 | Success-indicator "geen page-specifieke .card/.panel classes" i.p.v. bundle-size | P5 | Meetbaar en zinvol |
| 14 | Bulk-action-bar blijft inline (niet als 7e primitive), maar met eigen CSS-class in shared status-strip.css | P3 | Slechts 1 use-case |
| 15 | AppShell tokens-migratie splits in 2 commits (tokens, dan role-badge swap) | P5 | Eng-finding — twee wijzigingen samen = harder te debuggen |

## Implementation Tasks (aggregated)

- [ ] **T1 (P1, ~15 min)** — Bel Sandra of Luke: valideer premise "consistentie is nu het pijnpunt". Als nee → pauzeer plan.
- [ ] **T2 (P1, ~2u)** — Backend `/api/meta/statuses` endpoint (UC6).
- [ ] **T3 (P1, ~30min)** — Missing-states matrix per primitive schrijven, doorgeven aan implementer.
- [ ] **T4 (P2, ~20min)** — Datetime utils extraheren (F2.5) als eerste losse quick-PR.
- [ ] **T5 (P2, ~1-2u)** — Card + CardFooter + padding-scale + loading/empty compounds.
- [ ] **T6 (P2, ~1u)** — Modal via Radix Dialog wrappen (i.p.v. zelf inert-polyfill).
- [ ] **T7 (P2, ~2u)** — Toast provider met ErrorBoundary, promise-pattern, errors persistent.
- [ ] **T8 (P2, ~1u)** — ConfirmDialog primitive voor 7× window.confirm() vervangingen.
- [ ] **T9 (P2, ~30min)** — StatusBadge splitsen: StatusBadge (lifecycle) + ChannelStatus (health) + RoleBadge (identiteit).
- [ ] **T10 (P2, ~2-3u)** — F1.3 Login migratie EERST, evalueer, dan SeoPaginas.
- [ ] **T11 (P2, ~30min)** — Autosave-indicator dubbel in VP fixen.
- [ ] **T12 (P3, ~3-4u)** — ActionButtonGroup + adoptie in 4 pagina's (Dashboard/CW/Gp/Gebr).
- [ ] **T13 (P3, ~2u)** — Modal-adoptie voor Gebruikers + Gepubliceerd.
- [ ] **T14 (P3, ~2u)** — Toast/FormMessage boundary-tabel + adoptie op alle pagina's.
- [ ] **T15 (SKIP)** — TabBar als primitive (te weinig use-cases, UC3).
- [ ] **T16 (SKIP)** — FilterBar als primitive (te weinig use-cases, UC3).
- [ ] **T17 (P3, ~2u)** — AppShell tokens (splits van role-badge swap).
- [ ] **T18 (P3, ~1u)** — Table-overflow op mobiel (Gepubliceerd + CW).
- [ ] **T19 (P3, ~2u)** — Shadcn ui/*-map + `@radix-ui/*` (except dialog!) + CVA purgen. Behoud Tailwind.

## Completion Summary

- Plan **APPROVED met significant revisions** — 7 User Challenges naar de gate.
- 15 auto-decisions gelogd (P1-P5 principles).
- Scope aanzienlijk gereduceerd: TabBar + FilterBar geschrapt, Modal via Radix, Tailwind behouden.
- **Nieuwe PR-structuur**: PR 0 (Sandra/Luke gesprek + backend meta) → PR 1a (Login migratie) → PR 1b (SeoPaginas migratie) → PR 2a (Card + StatusBadge-splits + Modal + ConfirmDialog) → PR 2b (Toast + datetime + Autosave dubbel-fix) → PR 3 (ActionButtonGroup adoptie + Shadcn-map purge + table-overflow). Zes PRs i.p.v. vier, elk kleiner en veiliger.
- Doorlooptijd realistisch: 2-3 weken kalender, ~6-8 dagen actief werk.

---

# APPROVED — Post-review revisions

Autoplan afgerond 2026-09-02. Alle 7 User Challenges geaccepteerd. Origineel voorstel en migratiepad blijven als context staan; onderstaande wijzigingen overrulen:

## Superseded — UC1 Shadcn-purge scope

**Was**: "Shadcn eruit op SeoPaginas + Login → alles op plain-CSS + tokens. Deps kunnen worden gepurged in Fase 3."
**Is nu**:
- **Alleen** `frontend/src/components/ui/*` map verwijderen + `@radix-ui/*` deps (EXCEPT `@radix-ui/react-dialog`) + `class-variance-authority` (CVA).
- **Tailwind blijft** — het zit diep in `index.css` (@layer base @apply border-border), MediaPicker, StatusStrip, FormMessage, DashboardCharts, TypeBadge, en zelfs VP + MP hebben Tailwind-classes. Weghalen zou app-brede regressie zijn.
- Migreer eerst Login (klein, veilig), evalueer, dan SeoPaginas.
- Migreer TypeBadge, FormMessage, DashboardCharts weg van Shadcn primitives BINNEN de purge-PR (anders build-breakage).

## Superseded — UC2 Modal via Radix Dialog

**Was**: "Zelf implementeren met `inert` polyfill (~40 regels)"
**Is nu**: Wrap `@radix-ui/react-dialog` in dunne branded `<Modal>` component. Focus-trap, escape, portal-render gratis. Behoud radix-dialog dep (uitzondering op UC1 purge).

## Superseded — UC3 TabBar + FilterBar geschrapt

**Was**: F2.4 TabBar + F3.2 FilterBar als shared primitives.
**Is nu**: Beide geschrapt. TabBar heeft 3 use-cases (VP + MP allebei al opgeschoond, SeoPaginas na F1.3 kan hetzelfde patroon aanroepen). FilterBar heeft 2 use-cases. Onder "gebruik minimaal 3 keer"-drempel. Uitstellen tot 4e use-case.

## Superseded — UC4 StatusBadge splitsen

**Was**: `StatusBadge` uitbreiden met channel-tones + integration-tones + role-tones (16+ entries).
**Is nu**: Drie afzonderlijke componenten met gedeelde `.pill-base` CSS:
- `<StatusBadge status={...} />` — draft-lifecycle (huidig, 7 tones)
- `<ChannelStatus status="success|pending|failed" />` — kanaal-publicatiestatus (nieuw of uitbreiding van bestaande `ChannelIndicator.jsx`)
- `<RoleBadge role="owner|recruiter|viewer" />` — identiteit (nieuw of uitbreiding van bestaande `TypeBadge.jsx`)

## Superseded — UC5 User-interview eerst

**Was**: Impliciet geen user-interview vereist.
**Is nu**: **BLOCKER voor PR-werk**. Bel Sandra of Luke voor 15 minuten. Vraag "waar loop je nu tegenaan?".
- Als antwoord "de app is inconsistent / dingen zien er verschillend uit" → doorgaan met plan.
- Als antwoord "ik wil dat de tool suggesties geeft / bulk-actions makkelijker / etc." → plan pauzeren en heroverwegen.

## Superseded — UC6 Backend status-normalisatie erbij

**Was**: "Geen backend-wijzigingen" als goal 6.
**Is nu**: Nieuwe endpoint `GET /api/meta/statuses` die label + tone per status-code teruggeeft. Frontend `STATUS_META` haalt hieruit op via TanStack Query. Voorkomt dat elke nieuwe consumer opnieuw mapt.

## Superseded — UC7 Autosave-indicator dubbel in VP fixen

**Was**: Buiten scope (was blijvend punt uit vorige plan-ronde).
**Is nu**: 30-min fix meenemen in PR 2b. Toont autosave alleen in sticky-footer, top-of-form indicator verwijderen.

## Nieuwe PR-structuur (definitief)

1. **PR 0 — Validatie + backend meta**
   - Sandra/Luke 15-min gesprek (blocker; hand-off van user)
   - Backend `/api/meta/statuses` endpoint
   - Missing-states matrix per primitive schrijven

2. **PR 1a — Login migratie + Card primitive**
   - `<Card>` component + CardHeader/CardFooter/padding-scale/loading-compound
   - Emphasized visueel: `border-top: 3px solid var(--color-primary)`
   - Login migreren van Shadcn `Card`/`Button`/`Input`/`Label` naar plain + Card

3. **PR 1b — SeoPaginas migratie + StatusBadge splitsing**
   - StatusBadge → StatusBadge (lifecycle) + ChannelStatus + RoleBadge (3 componenten, gedeelde `.pill-base`)
   - SeoPaginas migreren naar plain + shared primitives
   - Vervang alle hardcoded status-pills en channel-dots (Gepubliceerd + MerkInstellingen + Header)

4. **PR 2a — Modal + ConfirmDialog + adoptie**
   - `<Modal>` via `@radix-ui/react-dialog` wrap (size sm/md/lg + mobile-fullscreen)
   - `<ConfirmDialog>` primitive voor 7× `window.confirm()`-vervangingen
   - Modal-adoptie in Gebruikers create-form + Gepubliceerd reschedule

5. **PR 2b — Toast + FormMessage + DateTime + Autosave dubbel-fix**
   - Datetime utils extraheren (eerst als quick-commit)
   - `<Toast>` provider met ErrorBoundary + `toast.promise()` + errors persistent tot dismiss
   - FormMessage tone-set uitbreiden
   - Boundary-tabel: form-submit-error → inline; publish-error → toast; save-success → toast; validation-error → inline
   - Autosave-indicator dubbel in VP fixen (verwijder top-of-form, houd sticky-footer)

6. **PR 3 — ActionButtonGroup + Shadcn-map purge + tables**
   - `<ActionButtonGroup>` component + adoptie in Dashboard/CW/Gp/Gebr row-actions
   - Purge `components/ui/*` map + `@radix-ui/react-*` deps (behalve `react-dialog`) + CVA
   - Migreer TypeBadge/FormMessage/DashboardCharts weg van Shadcn (behoud Tailwind)
   - Table-overflow op mobiel voor Gepubliceerd + CW

## Geschrapt uit plan

- F2.4 TabBar als shared primitive
- F3.2 FilterBar als shared primitive
- F3.1 AppShell/Header/Sidebar tokens-migratie (dev-comfort, geen user-value — later)
- Tailwind purge (buiten scope — Tailwind blijft)

## Doorlooptijd (herzien)

- **2-3 weken kalendertijd** i.p.v. 1.5 week (realistisch met review + preview rondes)
- **~6-8 dagen actief werk** verspreid over 6 PRs

## Success-indicatoren (herzien)

- Alle status-pills komen uit `<StatusBadge>`, `<ChannelStatus>` of `<RoleBadge>`.
- Geen import van `@/components/ui/` meer.
- `window.confirm()` nergens meer in gebruik.
- Iedere pagina met card-achtige container gebruikt `<Card>`.
- Foutmeldingen komen uit `<Toast>` of `<FormMessage>`, geen raw `<p>`.
- Sandra of Liza noemt onprompted (of op vraag) dat de tool "sneller aanvoelt" of "consistenter oogt".
- Nieuwe pagina bouwen kost < X uur zonder page-specifieke card/badge/modal CSS.

## Status

**APPROVED for implementation** — na Sandra/Luke-gesprek (PR 0).

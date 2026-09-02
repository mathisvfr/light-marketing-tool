# Missing-states matrix — shared primitives

Doel: voor élk nieuw shared component in de tool-brede UX-pass (plan
`docs/plans/tool-wide-ux-cleanup.md`) van tevoren vastleggen welke
visuele states gedekt moeten zijn. Zonder deze checklist is het risico
dat implementers alleen de happy-path renderen; failure/empty/overflow
komen dan pas later als bug-report terug.

Deze matrix is deliverable van **PR 0**. PR 1a (Card + Login), PR 1b
(SeoPaginas + StatusBadge-splits), PR 2a (Modal + ConfirmDialog),
PR 2b (Toast + FormMessage) en PR 3 (ActionButtonGroup) moeten elk hun
regels hieronder aftikken vóór merge.

Convention: elke state = een concreet visueel patroon + acceptance
criterium. Als een state N/A is, expliciet motiveren waarom.

---

## `<Card>` (PR 1a)

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| Default | Ja | Wit background, `--color-border`, `--radius-md`, `--shadow-xs`, padding via `padding` prop (sm=12px / md=16px / lg=24px) | Rendert zonder crash met alleen children |
| Emphasized | Ja | Extra `border-top: 3px solid var(--color-primary)` (echo van logo-notch DNA) | `<Card tone="emphasized">` toont accent-lijn |
| With header | Ja | `<CardHeader title="..." action={optional} />` = flex row, title font-display, action right-aligned | Header + body scheiding zichtbaar |
| With footer | Ja | `<CardFooter>` = flex row met border-top scheiding | Bijv. voor "Opslaan"-knop in Publicatiepatronen-form |
| Loading | Ja | `<Card.Loading />` compound = skeleton met dashed border + `Laden...` tekst | Vervangt huidige `<p>Dashboard wordt geladen...</p>` |
| Empty | Ja | `<Card.Empty message="Geen data" action={optional} />` = gecentreerd, muted kleur | Bijv. voor lege approval-queue op Dashboard |
| Overflow (body) | Ja | Body scrollt intern als max-height gezet; header + footer sticky | Bijv. long lists |
| Mobile (<640px) | Ja | Padding valt terug naar sm ongeacht prop | Voorkomt te veel witruimte op klein scherm |

**N/A**: error-state (errors horen in `<Toast>` of `<FormMessage>`, niet in Card zelf).

---

## `<Modal>` (PR 2a — via Radix Dialog wrap)

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| Open (default) | Ja | Backdrop 50% opacity, modal gecentreerd, size prop (sm=400px / md=560px / lg=720px) | Radix Dialog handles focus-trap + escape |
| Closed | Ja | Volledig unmounted (`Dialog.Root open={false}`) | Geen orphan-DOM, memory-friendly |
| Loading (async open) | Nee | N/A — open-state is synchroon | Documenteer in usage-guide |
| Submitting (form-in-modal) | Ja | Primary button toont spinner + disabled, andere buttons disabled | Voorkomt dubbele submit |
| Error (submit fail) | Ja | Inline `<FormMessage type="error">` binnen modal-body, boven de knoppen. Modal blijft open. | User ziet fout zonder modal-restart |
| Dirty (unsaved changes) | Ja | Backdrop-click en Escape triggeren `onCloseAttempt` — parent beslist of confirm-dialog opent | Verlies-preventie |
| Mobile (<640px) | Ja | Fullscreen: geen backdrop, modal vult viewport, close-knop in top-right | Voorkomt iOS-Safari keyboard-issues |
| Long content | Ja | Header + footer sticky, body scrollable | Ook op laptops met 800px height |
| Prefers-reduced-motion | Ja | Fade-in/-out uitzetten (`@media (prefers-reduced-motion)`) | A11y baseline |

**N/A**: empty (modals hebben altijd content), overflow-x (max-width via size prop).

---

## `<ConfirmDialog>` (PR 2a)

Wrappt `<Modal>` met een specifieke API. Vervangt 7× `window.confirm()`
in Gp, CW, SEO.

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| Open — normale confirmatie | Ja | Modal size=sm, title + message, twee buttons (Annuleren secondary, Bevestigen primary) | Focus start op Annuleren (destructive-veilig) |
| Open — destructieve confirmatie | Ja | Primary button variant=danger (rood), title bevat "verwijderen"/"annuleren" | Focus start op Annuleren, extra `type="destructive"` prop |
| Submitting | Ja | Bevestigen-knop toont spinner + beide disabled | Voorkomt dubbele delete |
| Error (action fail) | Ja | Inline `<FormMessage type="error">` in dialog-body, dialog blijft open | User kan retry |
| Mobile | Ja | Zelfde als Modal fullscreen | — |

---

## `<Toast>` (PR 2b)

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| Success | Ja | Groen background, `role="status"`, ✓ icoon, auto-dismiss 4s | Screenreader kondigt kalm aan |
| Error | Ja | Rood background, `role="alert"`, ✕ icoon, **persistent tot dismiss** | User mist geen fout bij afwenden |
| Attention | Ja | Amber background, `role="status"`, ⚠ icoon, auto-dismiss 6s | Voor "verlopen binnenkort" etc. |
| Info | Ja | Neutraal (grey-100), `role="status"`, ⓘ icoon, auto-dismiss 4s | Voor "concept opgeslagen" etc. |
| Stack (meerdere tegelijk) | Ja | Max 3 stapelen, nieuwste bovenop, oudere schuiven weg | Voorkomt scherm-vulling |
| Dismiss | Ja | X-knop rechtsboven, ook Escape sluit meest-recente | Keyboard-accessible |
| Mobile position | Ja | Bottom-center (duim-bereikbaar) i.p.v. top-right | Native-app feel |
| Loading state (`toast.promise()`) | Ja | Neutraal + spinner + "Bezig..." tekst tot promise settled | Vervangt door success/error na resolve |
| Prefers-reduced-motion | Ja | Geen slide-in animatie, alleen fade | A11y baseline |

**N/A**: empty (er is geen toast als er geen toast is), overflow-x (max-width vast).

**Error-handling**: `<ToastProvider>` MOET binnen een `<ErrorBoundary>`
staan zodat een throw in de reducer niet de hele app sloopt.

---

## `<StatusBadge>` (PR 1b — na splitsing)

Reduceert tot alleen draft-lifecycle. `<ChannelStatus>` en `<RoleBadge>`
zijn aparte componenten met dezelfde `.pill-base` CSS.

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| Bekende status (draft/pending_approval/approved/actief/published/expired/rejected) | Ja | Icoon + label uit `/api/meta/statuses`, tone-kleur | Non-color-only via icoon |
| Onbekende status (fallback) | Ja | Grey badge, raw status string als label | Voorkomt crash op nieuwe DB-values |
| Loading (meta-endpoint fetch pending) | Ja | Skeleton pill 60px breed, subtiele shimmer | 1st-load state |
| Overflow (lang label) | Ja | Max-width 160px + ellipsis + title-tooltip | Voorkomt kapotte tabel-layout |
| Prefers-reduced-motion | Ja | Live-status pulse-animatie uitzetten | A11y |

---

## `<ChannelStatus>` (PR 1b — nieuw component of `ChannelIndicator.jsx` uitbreiden)

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| scheduled / success / failed / pending / cancelled | Ja | Icoon + label uit `/api/meta/statuses` (channels namespace) | Vervangt hardcoded `.status-dot`-classes in Gp + Merk |
| Onbekende status | Ja | Grey fallback | — |
| Compact-mode (alleen dot, geen label) | Ja | `<ChannelStatus status="..." compact />` — 12px dot + `aria-label` | Voor tabellen waar ruimte krap is (bijv. Gp tabel) |

---

## `<RoleBadge>` (PR 1b — nieuw of `TypeBadge.jsx` uitbreiden)

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| owner / recruiter / viewer | Ja | Label uit `/api/meta/statuses` (roles namespace), tone-kleur | Vervangt `ROLE_BADGE`-inline in Header |
| Onbekende rol | Ja | Grey fallback | — |

---

## `<ActionButtonGroup>` (PR 3)

| State | Verplicht? | Visueel patroon | Acceptance criterium |
|-------|-----------|-----------------|----------------------|
| Default | Ja | Flex row, `gap: var(--space-2)`, wrapt op mobiel | Vervangt inline `.form-actions`/`.marketing-actions`/etc. |
| Single button | Ja | Blijft flex-row (geen speciale casus) | Wordt geen wrapper-overhead |
| Autosave-slot | Nee (opt-in) | `<ActionButtonGroup autosave={<span>...</span>}>` = autosave rechts inline, buttons links | Voor sticky-footer usage |
| Primary button pending | Ja | `<Button variant="primary" loading>` = spinner + disabled | Voorkomt dubbele submit |
| All disabled | Ja | Buttons opacity 0.5 + `cursor: not-allowed` | Voor "wacht op autosave"-scenario |
| Mobile (<640px) | Ja | Buttons stapelen full-width | Vermijdt te-klein-om-te-tappen |

---

## Cross-cutting: prefers-reduced-motion

Alle animaties (Modal fade, Toast slide, StatusBadge live-pulse,
Card hover) moeten binnen een `@media (prefers-reduced-motion: reduce)`
worden uitgezet. Één plek bijhouden: `frontend/src/index.css` met een
media-query die relevante `animation`/`transition` op `none` zet.

---

## Cross-cutting: focus-visible

Iedere klikbare shared primitive (Card met onClick, Modal-buttons,
Toast dismiss, ActionButtonGroup buttons, StatusBadge indien klikbaar)
krijgt een zichtbare focus-ring via `box-shadow: 0 0 0 3px
var(--color-focus-ring)` op `:focus-visible`. Dit is baseline
a11y-requirement; geen tickable optie.

---

## Sign-off

Elke PR die één van deze primitives toevoegt, MOET dit doc updaten
met ✅ per behandelde state. Als state is overgeslagen (bijv.
"loading-state komt in aparte PR"): expliciet noteren met TODO +
ticket-ref.

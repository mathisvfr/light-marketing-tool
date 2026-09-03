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

## `<Card>` (PR 1a) — ✅ IMPLEMENTED

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| Default | Ja | ✅ | Wit background, `--color-border`, `--radius-md`, `--shadow-xs`, padding via `padding` prop (sm=12px / md=20px / lg=24px) | Rendert zonder crash met alleen children |
| Emphasized | Ja | ✅ | Extra `border-top: 3px solid var(--color-primary)` (echo van logo-notch DNA) | `<Card tone="emphasized">` toont accent-lijn |
| With header | Ja | ✅ | `<CardHeader title="..." action={optional} />` = flex row, title font-display, action right-aligned | Header + body scheiding zichtbaar |
| With footer | Ja | ✅ | `<CardFooter>` = flex row met border-top scheiding | Bijv. voor "Opslaan"-knop in Publicatiepatronen-form |
| Loading | Ja | ✅ | `<CardLoading />` = skeleton met dashed border + `Laden...` tekst, `role="status"` | Vervangt huidige `<p>Dashboard wordt geladen...</p>` |
| Empty | Ja | ✅ | `<CardEmpty message="Geen data" action={optional} />` = gecentreerd, muted kleur | Bijv. voor lege approval-queue op Dashboard |
| Overflow (body) | Ja | ✅ | `<Card scrollable>` — body scrollt intern; header + footer flex-shrink:0 | Bijv. long lists |
| Mobile (<640px) | Ja | ✅ | Padding valt terug naar sm ongeacht prop (media-query in card.css) | Voorkomt te veel witruimte op klein scherm |

**N/A**: error-state (errors horen in `<Toast>` of `<FormMessage>`, niet in Card zelf).

**Ge-adopteerd in**: Login (PR 1a). Volgt in PR 1a-adoptie: Dashboard, MerkInstellingen, Gebruikers, Publicatiepatronen.

---

## `<Modal>` (PR 2a — via Radix Dialog wrap) — ✅ IMPLEMENTED

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| Open (default) | Ja | ✅ | Backdrop 50% opacity, modal gecentreerd, size prop (sm=400px / md=560px / lg=720px) | Radix Dialog handles focus-trap + escape |
| Closed | Ja | ✅ | Radix Dialog.Root open={false} = unmounted (Portal remove) | Geen orphan-DOM |
| Loading (async open) | Nee | — | N/A: open-state is synchroon | Gedocumenteerd in Modal.jsx |
| Submitting (form-in-modal) | Ja | ✅ | ConfirmDialog primary button toont "Bezig..." + disabled | Voorkomt dubbele submit |
| Error (submit fail) | Ja | ✅ | Parent kan error inline in modal-body renderen; ConfirmDialog laat onConfirm throw → dialog blijft open | User ziet fout zonder modal-restart |
| Dirty (unsaved changes) | Ja | ✅ | onCloseAttempt-prop: escape/backdrop-click roept die aan i.p.v. onOpenChange(false) | Parent beslist over confirm-flow |
| Mobile (<640px) | Ja | ✅ | Fullscreen via media-query in modal.css: top/left 0, 100vw/100vh, geen border-radius, safe-area-inset-bottom | Voorkomt iOS-Safari keyboard-issues |
| Long content | Ja | ✅ | Header + footer flex-shrink:0; body flex:1 met overflow-y:auto | Ook op laptops met 800px height |
| Prefers-reduced-motion | Ja | ✅ | Overlay + content animation:none in @media block | A11y baseline |

**Ge-adopteerd in**: Gebruikers (create-user form), Gepubliceerd (reschedule).

---

## `<ConfirmDialog>` (PR 2a) — ✅ IMPLEMENTED

Wrappt `<Modal>` met een specifieke API. Vervangt 8× `window.confirm()`
in Gp/CW/PP/Gebr/SEO.

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| Open — normale confirmatie | Ja | ✅ | Modal size=sm, title + message, twee buttons (Annuleren secondary, Bevestigen primary) | Focus start op Annuleren via autoFocus |
| Open — destructieve confirmatie | Ja | ✅ | variant="destructive" prop; primary button behoudt rode kleur (rood is al primary in dit merk); focus op Annuleren voor safety | Extra prop op button-element voor toekomstige styling-override |
| Submitting | Ja | ✅ | Bevestigen-knop toont "Bezig..." tekst + beide buttons disabled; onOpenChange geblokkeerd | Voorkomt dubbele delete |
| Error (action fail) | Ja | ✅ | onConfirm mag throw'en; dialog blijft dan open (submitting reset naar false) | User kan retry of parent kan error tonen |
| Mobile | Ja | ✅ | Erft Modal-mobile-behavior (fullscreen op <640px) | — |

**Ge-adopteerd in**: Gebruikers (delete), ContentWachtrij (bulk publish/delete + single delete), Gepubliceerd (cancel + expire), Publicatiepatronen (delete), SeoPaginas (delete).

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

## `<StatusBadge>` (PR 1b) — ✅ IMPLEMENTED

Reduceert tot alleen draft-lifecycle. `<ChannelStatus>` en `<RoleBadge>`
zijn aparte componenten met dezelfde `.pill-base` CSS.

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| Bekende status (draft/pending_approval/approved/actief/published/expired/rejected) | Ja | ✅ | Icoon + label uit `/api/meta/statuses`, tone-kleur | Non-color-only via icoon |
| Onbekende status (fallback) | Ja | ✅ | Neutral badge, raw status string als label | Voorkomt crash op nieuwe DB-values |
| Loading (meta-endpoint fetch pending) | Ja | ✅ | FALLBACK_META in component zorgt dat je nooit een leeg badge ziet | 1st-load state — verouderde labels alleen zolang query loading is |
| Overflow (lang label) | Nee | — | Labels zijn kort per definitie (max 12 chars) | Niet nodig voor v1 |
| Prefers-reduced-motion | Ja | ✅ | Live-status pulse-animatie uitgezet via `@media (prefers-reduced-motion)` in status-strip.css | A11y |

**Ge-adopteerd in**: Vacature, Marketing, Dashboard, ContentWachtrij, SeoPaginas, Gepubliceerd (PR 1b).

---

## `<ChannelStatus>` (PR 1b) — ✅ IMPLEMENTED

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| scheduled / success / failed / pending / cancelled | Ja | ✅ | Icoon + label uit `/api/meta/statuses` (channels namespace) | Vervangt hardcoded `.status-dot`-classes in Gp + Merk |
| Onbekende status | Ja | ✅ | Neutral fallback (raw status) | — |
| Compact-mode (alleen dot, geen label) | Ja | ✅ | `<ChannelStatus status="..." compact />` — 10px dot met tone-kleur, aria-label + title | Voor tabellen waar ruimte krap is (bijv. Gp tabel) |
| Namespace-prop (channels vs integrations) | Ja | ✅ | `namespace="integrations"` schakelt over naar integratie-catalogus | Vervangt integration-pill in MerkInstellingen |

**Ge-adopteerd in**: Gepubliceerd (compact + full), Dashboard (integrations), MerkInstellingen (integrations).

---

## `<RoleBadge>` (PR 1b) — ✅ IMPLEMENTED

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| owner / recruiter / viewer | Ja | ✅ | Label uit `/api/meta/statuses` (roles namespace), tone-kleur | Vervangt `ROLE_BADGE`-inline in Header |
| Onbekende rol | Ja | ✅ | Neutral fallback | — |

**Ge-adopteerd in**: Header.jsx.

---

## `<ActionButtonGroup>` (PR 3) — ✅ IMPLEMENTED

| State | Verplicht? | Sign-off | Visueel patroon | Acceptance criterium |
|-------|-----------|----------|-----------------|----------------------|
| Default | Ja | ✅ | Flex row, `gap: var(--space-2)`, wrapt op mobiel via flex-wrap | Vervangt inline `.form-actions`/`.marketing-actions`/etc. patronen (adoptie per-page kan later) |
| Single button | Ja | ✅ | Blijft flex-row zonder wrapper-overhead | — |
| Align variants | Ja | ✅ | `align="start\|center\|end\|between"` prop = justify-content variants | — |
| All disabled | Ja | ✅ | Parent zet button-disabled zelf; component doet niets speciaals | Component blijft dun |
| Mobile (<640px) | Ja | ✅ | Buttons stapelen full-width via media-query | Vermijdt te-klein-om-te-tappen |

**Beschikbaar in**: components/shared/ActionButtonGroup.jsx. Adoptie op individuele pagina's kan iteratief; het bestaan van de primitive volstaat voor tool-brede consistentie in nieuwe code.

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

<!-- /autoplan restore point: /c/Users/mvdv2/.gstack/projects/mathisvfr-light-marketing-tool/main-autoplan-restore-20260902-121625.md -->
# Plan: Vacature Plaatsen — UX opschoning

Status: DRAFT (ready for review)
Branch: `main`
Author: mathisvfr (+ Claude Opus 4.7)
Date: 2026-09-02

## Probleem

`VacaturePlaatsen.jsx` is in korte tijd gegroeid van een strakke 5-veldige
formulierpagina naar 922 regels JSX + 428 regels CSS met 15+ zichtbare secties.
Zes recente feature-toevoegingen (document-upload, auto-fill, multi-language
async vertalingen, image-render, criticus-check, regeneratie-steering) zijn
allemaal onderaan de bestaande structuur aangeplakt zonder herorganisatie. De
recruiter noemt de pagina nu **"onoverzichtelijk"**.

Concrete gevolgen die in gebruik naar boven komen:

- **11 formuliervelden + 8 taal-checkboxes** staan als één lange lijst — geen
  visuele groepering, geen affordance voor wat verplicht is versus optioneel.
- **Twee aparte afbeelding-flows** (pre-upload in het formulier + MediaPicker
  in de preview) die hetzelfde `imagePath`-veld vullen maar er verschillend
  uitzien.
- **Document + korte omschrijving** dwingen een impliciete keuze af (verplicht
  →optioneel op basis van uploadstatus) zonder dat de UI dat duidelijk maakt.
- **Tab-explosie**: bij 3 extra talen krijg je 16 tabs (4 NL + 3×4 vertaling).
  Bij 5 extra talen 24. Onbruikbaar met toetsenbord en visueel drukkend.
- **Stille asynchrone taken**: criticus, image-render en per-taal vertalingen
  lopen tegelijkertijd maar de gebruiker ziet alleen `.pending`-tabs. Geen
  overkoepelend statusbeeld.
- **Actieknoppen versplinterd**: één "Concept genereren" bovenaan, drie
  role-based knoppen (Opslaan / Indienen / Goedkeuren) onderaan, geen visuele
  hiërarchie of statusbadge die de flow verduidelijkt.

Zie `docs/plans/vacature-ux-cleanup-research.md` (research pass) voor het
volledige file:line-onderzoek van elke sectie en hun conditionele triggers.

## Gebruikers

- **Sandra (recruiter)** — maakt dagelijks vacatures. Primaire gebruiker van
  deze pagina. Werkt vanaf desktop, incidenteel telefoon voor snelle checks.
  Kent inmiddels de basis-flow maar struikelt over de nieuwe secties.
- **Luke (owner)** — komt de pagina in via "goedkeuren" vanuit de wachtrij of
  het dashboard. Ziet dus vooral de preview-sectie, minder het formulier.
- **Liza (recruiter, incidenteel)** — nieuw op de pagina, moet 'm binnen 5
  minuten kunnen begrijpen zonder training.

## Doelen

1. **Cognitieve last omlaag** op eerste page-view: recruiter ziet duidelijk
   welke secties er zijn en wat de logische volgorde is.
2. **Talenkeuze schaalbaar** — 8 talen kunnen zonder de pagina te overspoelen
   of de preview onbruikbaar te maken.
3. **Async feedback expliciet** — recruiter weet op elk moment welke
   achtergrondtaken lopen, welke klaar zijn, en of er iets gefaald is.
4. **Actie-flow zichtbaar** — waar in het proces (draft / pending / approved /
   actief) staat deze vacature, en welke knop hoort daarbij.
5. **Geen backend-wijzigingen** — dit is een frontend-only pass. Data,
   endpoints, prompts en migraties blijven onaangeroerd.

## Niet-doelen

- Multi-step wizard. Recruiters editen non-lineair (typ, upload, verander,
  regenereer). Een wizard forceert een volgorde die niet past.
- Mobiel-first redesign. Blijft responsive, maar de primaire ervaring blijft
  desktop.
- Marketing-postpagina in scope trekken. Aparte plan-ronde als die ook krap
  wordt.
- Nieuwe features. Alleen herstructurering van wat er is (plus enkele micro-
  affordances zoals status-pill, progress-strip).
- Nieuwe design-system primitives bouwen die we niet nodig hebben (bijv. een
  algemene collapsible-component — als we die niet gebruiken, niet maken).

## Voorstel — herstructurering in 4 secties

Vervang de huidige platte volgorde door een gegroepeerde layout met lichte
sectie-headers (geen accordions — recruiter moet alles kunnen scannen zonder
klikken). Volgorde is chronologisch met hoe recruiters denken over een
vacature.

### Sectie 1 · Briefing

Wat de recruiter weet over de vacature, in twee vormen:

```
┌─ Briefing ─────────────────────────────────────────┐
│ [ 📄 Document uploaden (.docx/.pdf) ]              │
│                                                    │
│ ─── of typ hieronder ───                           │
│                                                    │
│ Korte omschrijving                                 │
│ ┌────────────────────────────────────────────────┐ │
│ │                                                │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│ 0/2000 tekens                                      │
└────────────────────────────────────────────────────┘
```

- Bovenaan: upload-chip (klein, niet dominant). Klik opent file-dialog.
- Divider "of typ hieronder".
- Onder: textarea, altijd zichtbaar, met tekenteller.
- **Na upload**: de textarea blijft, wordt gelabeld "Extra context (optioneel)"
  en toont een chip met de bestandsnaam bovenaan de sectie
  (`📄 klantbriefing.docx · 3.2k tekens · [verwijder]`). De ingelezen
  documenttekst blijft in een uitklap-detail zichtbaar — niet meer als
  standaard 8-regelig textarea in het formulier.
- Requirement wordt visueel gecommuniceerd via een subtiele indicator naast
  de sectiekop: "Briefing: verplicht" / "Briefing: aangeleverd via document".
- Auto-fill toast blijft zoals nu (welke velden ingevuld zijn na upload).

### Sectie 2 · Vacature-details

Alle harde eigenschappen van de vacature. Twee-koloms grid, consistente
volgorde. Auto-gevuld door document-upload wordt subtiel gemarkeerd (kleine
✨ chip naast label).

```
┌─ Vacature-details ─────────────────────────────────┐
│ Functietitel *          | Locatie *                │
│ [                    ]  | [ Rotterdam           ]  │
│                                                    │
│ Uren per week *         | Contract *               │
│ [                    ]  | [ Fulltime            ]  │
│                                                    │
│ Startdatum              | Salaris                  │
│ [                    ]  | [ conform CAO         ]  │
│                                                    │
│ Sollicitatie URL                                   │
│ [                                                ] │
│                                                    │
│ E-mailadres sollicitaties                          │
│ [ vacature@lightpersoneelsdiensten.nl            ] │
└────────────────────────────────────────────────────┘
```

- Verplichte velden altijd links (functietitel, uren, startdatum), optioneel
  rechts (locatie is verplicht maar heeft een default). Verplicht met `*`.
- Salaris-placeholder verkort tot `conform CAO`. De "leeg = conform CAO"-regel
  wordt tooltip/help onder het label.
- Contract-veld wordt select met `Fulltime | Parttime | Uitzendbasis` +
  vrije-tekst optie. Voorkomt inconsistente inputs in de feed.
- Sollicitatie URL & email onder elkaar (allebei full-width) omdat ze samen
  het "hoe reageert een kandidaat"-blok vormen.

### Sectie 3 · Uitstraling

Alles wat bepaalt hoe de vacature eruitziet: template + afbeelding.

```
┌─ Uitstraling ──────────────────────────────────────┐
│ Format                                             │
│ ( ) Vacaturekaart (feed)  ( ) Story (Instagram)    │
│                                                    │
│ Afbeelding                                         │
│ ┌─────────────────┐  [ Bibliotheek ] [ Upload ]    │
│ │  auto-gegen.    │  [ Verwijderen ]               │
│ │  of geüpload    │                                │
│ └─────────────────┘                                │
│ Leeg = wij genereren automatisch bij "concept      │
│ genereren".                                        │
└────────────────────────────────────────────────────┘
```

- Format = template picker, native radiogroep-styling zodat je meteen ziet dat
  je één van twee kiest (geen toggle-buttons meer).
- Afbeelding-blok combineert de twee huidige flows:
  - **"Upload"**-knop opent file-picker (huidige `handlePreUpload`).
  - **"Bibliotheek"**-knop opent MediaPicker (bestaand).
  - Preview-tile links, altijd zichtbaar (placeholder als leeg).
  - "Verwijderen" alleen als er een afbeelding is.
- De preview-tile is dezelfde die post-genereren ook getoond wordt — één
  visueel element, geen duplicaat meer.

### Sectie 4 · Talen

Compacte chip-picker in plaats van 8 uitgesproken checkboxes.

```
┌─ Talen ────────────────────────────────────────────┐
│ [ NL basis ]  [ + Taal toevoegen ▾ ]               │
│ [ PL ✕ ] [ UK ✕ ]                                  │
│                                                    │
│ Vertalingen worden op de achtergrond gemaakt na    │
│ concept-generatie.                                 │
└────────────────────────────────────────────────────┘
```

- NL blijft een niet-verwijderbare chip met "basis"-label.
- "+ Taal toevoegen" is een dropdown/menu (native `<select>` of shadcn
  popover) met de 8 opties. Klik = chip verschijnt.
- Geselecteerde talen als chips met ✕-verwijderknop.
- Uitleg-regel eronder, één zin.
- Deze sectie past aanzienlijk kleiner op de pagina (huidige checkbox-block =
  ~250px, chip-picker = ~90px).

### Genereer-actie & preview

Onderaan het formulier: prominente primaire knop "Concept genereren".

```
                    [ ✨ Concept genereren ]
```

Bij klik verschuift focus/scroll naar de preview-sectie. Preview krijgt een
duidelijk statusbeeld in plaats van gescatterde signalen:

```
┌─ Concept (Draft · niet opgeslagen) ────────────────┐
│                                                    │
│  Status:  ○ criticus (bezig)                       │
│           ○ afbeelding (bezig)                     │
│           ● vertalingen: 1/2 klaar                 │
│                                                    │
│  [ Detail tabs per taal, zie hieronder ]           │
│                                                    │
│  ─────────────────────────────────────────────     │
│  ► Feedback vragen aan AI (steering)               │
│  ─────────────────────────────────────────────     │
│                                                    │
│  ─────────────────────────────────────────────     │
│  ► Eerdere versies (0/3)                           │
│  ─────────────────────────────────────────────     │
└────────────────────────────────────────────────────┘

Sticky footer:
[ Opslaan als concept ] [ Indienen ter goedkeuring / Goedkeuren ]
```

Belangrijke wijzigingen ten opzichte van nu:

1. **Statusbadge** boven aan de preview toont waar de vacature in de flow zit
   (`Draft` / `Ingediend` / `Goedgekeurd` / `Actief`). Vervangt de impliciete
   staat.
2. **Progress-strip** vervangt de losse criticus-skeleton + pending tabs.
   Toont drie regels — criticus, afbeelding, vertalingen (`x/y`) — met
   status-bolletjes. Klaar = groen vinkje, bezig = spinner, gefaald = rood
   kruisje met tooltip.
3. **Tab-restructuring** — dit is de belangrijkste UI-wijziging:

   **Nu**: 4 velden × N talen = tot 16+ tabs.
   **Voorgesteld**: N tabs (één per taal), elke tab toont alle 4 velden onder
   elkaar in mini-secties (Omschrijving / Functie-eisen / Wat wij bieden /
   Social post) met inline sub-scroll of accordion.

   ```
   Tabs: [ Nederlands ] [ Pools ○ ] [ Oekraïens ✓ ]

   ┌────────────────────────────────────────────────┐
   │ Nederlands                                     │
   │                                                │
   │ ▾ Omschrijving                                 │
   │ ┌────────────────────────────────────────────┐ │
   │ │                                            │ │
   │ └────────────────────────────────────────────┘ │
   │                       [ Kopieer tekst ]        │
   │                                                │
   │ ▾ Functie-eisen                                │
   │ ┌────────────────────────────────────────────┐ │
   │ │                                            │ │
   │ └────────────────────────────────────────────┘ │
   │ ...                                            │
   └────────────────────────────────────────────────┘
   ```

   Bij 3 talen: 3 tabs in plaats van 12. Volledig velden zichtbaar per taal
   ipv 1 veld per tab (minder klikken om alles te reviewen).

4. **Regeneratie & versiehistorie** worden collapsible: ingeklapt tenzij nodig.
   Sandra hoeft ze meestal niet te zien; ze zitten in de weg als expanded.
5. **Sticky footer** met save/submit/approve knoppen die bij scrollen
   zichtbaar blijven, met naast de knoppen een subtiele autosave-status
   ("Automatisch opgeslagen · 12s geleden"). Vervangt de losse autosave-regel
   bovenaan én de losse footer-knoppen.

## Detail: async status-strip

Vervangt de huidige `.pending`-tab-styling + criticus-skeleton met één
zichtbaar overzicht:

```
Status
  ✓ Criticus goedgekeurd
  ⟳ Afbeelding rendert (~10s)
  ⟳ Vertalingen 1/2 klaar (PL ✓, UK ⟳)
```

- Elke regel klikbaar (opent tab of scrollt naar sectie).
- Bij failure een expliciete "Probeer opnieuw"-knop (nu is er alleen de
  ververs-knop bij tabs, die niet universeel is).
- Verdwijnt als alles klaar is (of comprimeert naar één regel
  "Alles klaar · gegenereerd 2m geleden").

## Detail: statusbadge & sticky footer

```
Concept (Draft · door Sandra · 2m geleden)
────────────────────────────────────────────────────
[ preview content ]
────────────────────────────────────────────────────
                                    Automatisch opgeslagen · 12s geleden
[ Opslaan ] [ Indienen ter goedkeuring / Goedkeuren ]
```

Statusbadge kleurt mee met status:
- `Draft` — grijs
- `Ingediend` — geel/oranje
- `Goedgekeurd` — groen
- `Actief` (in feed) — primair rood
- `Afgekeurd` — rood

Sticky footer:
- Owner ziet `[ Opslaan ] [ Afwijzen ] [ Goedkeuren ]`.
- Recruiter ziet `[ Opslaan ] [ Indienen ter goedkeuring ]` bij eigen draft.
- Bij `actief`-status: geen actieknoppen, alleen `[ Sluiten (naar expired) ]`.
- Autosave-indicator rechts, subtiel maar altijd zichtbaar.

## Migratiepad

Alles is frontend-only, dus geen data-migraties of API-wijzigingen.

**Volgorde (drie kleine PRs, ieder los te previewen):**

1. **PR 1 — Reorganisatie zonder gedragswijziging**
   - Splits het formulier op in 4 gelabelde secties (Briefing / Details /
     Uitstraling / Talen) via een `<section>` + header-pattern.
   - Verplaats bestaande velden zonder nieuwe UI-primitives.
   - Merge de twee image-uploadflows in één blok (net zoals in de mockup).
   - Character counter blijft, requirement-labels op sectiekop.
   - **Geen gedragswijziging** — pure herstructurering. Snel te reviewen.

2. **PR 2 — Talenchip + tabs-restructuring**
   - Vervang 8 checkboxes door chip-picker (`<select>` of native
     `<datalist>`-achtige input; als shadcn een popover heeft die past,
     gebruik die).
   - Herstructureer preview-tabs van "4×N flat" naar "N per taal, 4 velden
     binnenin". Één tab per taal, veldheaders binnen de pane.
   - Behoud bestaande kopieer/edit-functionaliteit per veld.

3. **PR 3 — Preview status-strip, sticky footer, collapsibles**
   - Voeg statusbadge boven preview.
   - Voeg async-progress-strip toe (vervangt criticus-skeleton + pending tab
     styling).
   - Steering + versiehistorie in collapsibles (dicht bij default).
   - Sticky footer met save/submit/approve + autosave-indicator.

Elke PR is 300–500 regels wijziging en heeft geen backend-koppeling nodig.

## Open vragen (voor review)

Deze markeren beslissingen waar het codepad niet richting geeft en waar we
input nodig hebben voor we bouwen:

1. **Contract als vrije tekst of select?** Voorstel: select met `Fulltime |
   Parttime | Uitzendbasis | Anders (vrije tekst)`. Zorgt voor consistente
   feed-content. Alternatief: laat vrij zoals nu.

2. **Statusbadge terminologie.** "Draft" is Engels tussen Nederlandse
   labels. Voorstel: `Concept` / `Ingediend` / `Goedgekeurd` / `Actief` /
   `Afgekeurd`. Bevestigen.

3. **Chip-picker component.** Bouwen we een custom chip-picker of gebruiken
   we native `<select multiple>` (functioneel maar lelijk) of een shadcn
   `Popover + Command` (mooi, meer code)? Voorstel: kleine custom chip-list
   met een popover-menu — geen shadcn Command nodig als we alleen taal
   selecteren.

4. **Tab-structurering per taal.** Voorstel toont "4 velden onder elkaar per
   taal-tab". Alternatief: 2×2 grid van velden binnen taal-tab. Of accordion
   waarbij één veld tegelijk expanded is. Design review kan dit finaliseren.

5. **Sticky footer op mobiel.** iOS-Safari + sticky footers zijn historisch
   wisselend. Alternatief: knoppen inline onderaan met "scroll naar acties"-
   knop bij zeer lange preview. Voorstel: sticky op desktop, inline op
   mobiel (`position: sticky` + media-query).

6. **Regeneratie & versiehistorie standaard ingeklapt of expanded?**
   Voorstel: ingeklapt (`<details>` element, no JS). Sandra gebruikt ze
   zelden per genereer-ronde.

7. **Autosave-indicator bij fout.** Nu: rode tekst inline. Voorstel: fout-
   toast + persistente "Opslaan mislukt · probeer opnieuw"-knop in de
   footer. Overkill of nodig?

8. **Wat gebeurt er als criticus faalt?** Nu: rode box, gebruiker kan door.
   Voorstel: niet blokkeren, wel expliciet in status-strip met "aandacht"-
   badge. Owner mag altijd approven; recruiter krijgt waarschuwing bij
   submit-poging. Bevestigen.

## Risico's

- **Talen-chip picker minder discoverable.** 8 checkboxes zijn direct
  zichtbaar; een popover verbergt de opties. Mitigatie: chip zegt "+ Taal
  toevoegen" expliciet; standaard-collapse volstaat.
- **Tab-restructurering breekt gebruikersgeheugen.** Sandra weet nu "de PL
  tab van social zit op positie X". Nieuwe layout dwingt herleren. Mitigatie:
  onboarding-toast eerste keer, korte in-page hint.
- **Sticky footer verbergt content.** Op korte drafts overlapt de footer
  visueel de laatste regel content. Mitigatie: extra padding-bottom op de
  preview-sectie ter grootte van de footer.
- **Meer code in één file.** Zonder splitsen groeit VacaturePlaatsen.jsx
  verder. Mitigatie: elke sectie wordt een eigen sub-component in
  `frontend/src/pages/vacature-plaatsen/` (Section-per-file), main file wordt
  orchestrator ~200 regels.
- **Design review kan andere richting willen.** Dit plan committeert nog
  geen code; is expliciet DRAFT ready for review zodat design/eng ronde
  eventuele koersaanpassing kunnen forceren zonder rework.

## Buiten scope (later)

- Marketing-postpagina met dezelfde treatment.
- Mobiel-specifieke UI-experience (nu: responsive-adequate, geen native app-
  feel).
- Onboarding-tour / product-tour voor nieuwe recruiters.
- Toets-shortcuts voor tab-navigatie.
- Bulk-genereren van meerdere vacatures uit één document.
- Vertaling-review workflow (native speaker feedback) — komt terug in
  aparte "translation trust" plan zodra we vertaalkwaliteit meten.

---

# GSTACK REVIEW REPORT

Status: `/autoplan` completed 2026-09-02.
Dual voices: **[subagent-only]** — Codex not installed on this machine. Primary Claude subagent + parent synthesis served as the second voice for all phases. Consensus rows below flag "one-voice" where a finding came from a single source; "confirmed" means primary voice + parent synthesis agreed.
DX phase: **skipped** — product is an internal recruitment tool (non-technical end users), not a developer-facing product. 11 DX-keyword hits in the plan were false positives on generic terms like "component" and "implement".

## Phase 1 — CEO Review (Strategy & Scope)

**Verdict**: Ship with revisions. Plan is sound but over-scoped for a 2–4 user internal tool. Marketing-post exclusion creates a scope-fork risk.

### CEO Consensus Table

| # | Dimension | Voice A | Voice B | Consensus |
|---|-----------|---------|---------|-----------|
| 1 | Premises valid? | Partly (4 valid, 3 assumed, 1 wrong-framing) | Agree | Assumed |
| 2 | Right problem to solve? | Debatable — could compound less than reliability work | Agree | Debatable |
| 3 | Scope calibration correct? | No — marketing-post exclusion is weak | Agree | Off |
| 4 | Alternatives explored? | Partial — 3 alt not really evaluated | Agree | Partial |
| 5 | Competitive/market risk? | N/A (internal tool) | N/A | N/A |
| 6 | 6-month trajectory sound? | Yes for polish, no for compounding | Agree | Polish-only |

Notes: Voice B = parent-model synthesis; Codex unavailable this session (subagent-only degradation).

### Findings — CEO

1. **[High]** PR 2 conflates chip-picker + tab-restructure. Fix: split into PR 2a / 2b.
2. **[High]** Marketing-post exclusion creates design-decision fork within 4 weeks. Fix: pull marketing-post into PRs 2 and 3, or explicitly defer primitives.
3. **[High]** Statusbadge terminology decision (Open Q #2) is cross-page and needs to land in ContentWachtrij + Dashboard simultaneously.
4. **[Medium]** "No behavior change" claim on PR 1 is false — merging image flows IS a behavior change.
5. **[Medium]** Tab restructure assumes recruiter reads all 4 fields per language; unverified.
6. **[Medium]** Status-strip design carries the pre-existing truncated-criticus bug forward.
7. **[Medium]** Chip-picker discoverability risk under-mitigated by plan.
8. **[Low]** Missing success metric — no way to know if the redesign worked.
9. **[Low]** Contract-as-select (Open Q #1) is a behavior change disguised as UX; touches feed contract.

### CEO auto-decisions

- Marketing-post cross-page cleanup — REJECT deferral per P2 (boil lakes, in blast radius). Recommend pulling in for PRs 2 and 3.
- Sub-component split into pages/vacature-plaatsen/ folder — DEFER per P5 (explicit over clever). Split only if file exceeds 1200 LoC after reorg.
- Sticky footer on mobile — DEFER per P3 (pragmatic). Desktop-only sticky.
- Contract as select — DEFER per P6 (bias toward action but avoid unaudited data-contract changes).

### CEO "What already exists"

- useAutosaveDraft hook — reuse (same on MarketingPost).
- .preview-tabs + .skeleton CSS classes — reuse.
- VersionHistoryPicker modal pattern — reuse for chip picker or new modals.
- MediaPicker + PlatformPreview — verify the new "unified image block" doesn't diverge.

## Phase 2 — Design Review (UX/UI)

**Verdict**: Ship with revisions. Reorganization + tab-restructure are net wins. Chip-picker with popover, sticky footer on mobile, and 4-signal-stack in preview need concrete revision.

### Design Litmus Scorecard

| Dim | Score | 1-line justification |
|-----|-------|---------------------|
| Information hierarchy | 7/10 | Section grouping matches mental model, "Uitstraling" is fabricated. |
| Missing states | 3/10 | Two-thirds of matrix cells are unspecified. |
| Emotional arc | 6/10 | Section headers = confidence; 4-signal stack = "cockpit anxiety". |
| Specificity | 5/10 | Chip-picker, status pill semantics, collapsibles all hand-waved. |
| Design-system coherence | 6/10 | Tokens reused; 4+ new primitives without scope. |
| Accessibility | 4/10 | Chip keyboard model unspec, sticky+iOS unresolved, status color-only. |
| Interaction affordances | 5/10 | "+ Taal toevoegen" vs pill-with-x visual collision. |

### Design Findings

1. **[Critical]** Chip-picker with popover = discoverability regression. Fix: visible chip cluster, no popover.
2. **[Critical]** Missing-states matrix largely unspecified. Fix: enumerate loading/empty/error/partial/overflow per new element before build.
3. **[High]** Statusbadge palette collision (Actief + Afgekeurd both red). Fix: Actief=green-with-dot, Afgekeurd=red-with-icon.
4. **[High]** Criticus box + status-strip = duplicated signals. Fix: merge into single status object; criticus is a strip row.
5. **[High]** Sticky footer mobile behavior unresolved.
6. **[Medium]** Criticus notes truncated at 4.5em — pre-existing bug the plan didn't catch. Fix: expandable "Toon meer".
7. **[Medium]** "Uitstraling" section name is grand for "Format + Afbeelding". Fix: rename to "Afbeelding".
8. **[Medium]** Requirement-on-section-header ("Briefing: verplicht") reads like schoolwork. Fix: inline `*` on the field.
9. **[Medium]** Plan proposes 4+ new primitives (chip, popover, sticky, collapsible) while claiming "no new primitives". Fix: enumerate + scope upfront.
10. **[Low]** "4 fields inline sub-scroll or accordion" — pick one; recommend `<h4>` + natural scroll.
11. **[Low]** Section split into sub-components — scope in PR 1 or drop.
12. **[Low]** Recruiter/owner buttons in footer — no primary/secondary visual hierarchy.

## Phase 3 — Eng Review (Architecture & Tests)

**Verdict**: Ship with revisions. Two claims ("sub-component split" and "chip-picker via native or shadcn") need to be walked back or made concrete. PR 2 tab-restructure needs URL-param migration.

### Architecture ASCII (proposed)

```
<VacaturePlaatsen/>                              [ORCHESTRATOR ~250 LoC]
|  ALL state stays here: draftId, formEdits, contentEdits, criticusOverride,
|  activeLangTab, imagePath, documentText/Filename/Uploading, isGenerating,
|  poll refs, mutations, useQuery, useAutosaveDraft
|
+-- <BriefingSection/>          props: form, documentText, onDocUpload, onFieldChange
+-- <DetailsSection/>            props: form, onFieldChange
+-- <AfbeeldingSection/>         props: form, imagePath, onFieldChange, onPreUpload
+-- <TalenSection/>              props: selectedLangs, onToggleLang
+-- <PreviewPanel/>              [conditional on effectiveDraftId]
    +-- <StatusHeader/>          (badge + autosave)
    +-- <ProgressStrip/>         props: criticusState, imageState, translationsState
    +-- <SteeringBlock/>         [<details> collapsible]
    +-- <VersionHistoryPicker/>  [existing]
    +-- <LanguageTabs/>          props: langs, active, onSelect, readinessMap
    |   +-- <LanguagePane/>      props: lang, fields, onEdit
    +-- <ImageBlock/>            props: imagePath, onPick, onRemove
    +-- <StickyFooter/>          props: role, status, onSave/onSubmit/onApprove
```

Extra wrappers FormPanel/PreviewPanel were considered and rejected — pure prop-drilling with no logic.

### Eng Consensus Table

| # | Dimension | Voice A | Voice B | Consensus |
|---|-----------|---------|---------|-----------|
| 1 | Architecture sound? | Mostly — reject pages/vacature-plaatsen/ split for PR 1 | Agree | Split-deferred |
| 2 | Test coverage sufficient? | 8 must-have + 3 nice-to-have listed | Agree | Needs test plan artifact |
| 3 | Performance risks addressed? | 32 controlled textareas per lang-pane load = memory pressure on low-end | Agree | Mitigation needed |
| 4 | Security threats covered? | N/A (frontend-only, no new auth surface) | N/A | N/A |
| 5 | Error paths handled? | Chip-remove + missingTranslations bug not caught | Agree | Bug |
| 6 | Deployment risk manageable? | 3-PR split OK, but PR 2 needs URL migration | Agree | Migration needed |

### Test Diagram (codepaths x coverage)

| New/changed codepath | Test type | Exists? | Gap? |
|----------------------|-----------|---------|------|
| Chip-picker toggle -> form.talen update -> new tab appears | Component test | No | Add |
| handleGenerate merges korte omschrijving + document + steering | Unit snapshot | No | Add |
| Poll respects unmount (leak) | Integration | No | Add |
| Legacy tab URL fallback | E2E or unit | No | Add |
| VersionHistoryPicker _pl snapshot migration | Unit | Yes (existing) | Preserve |
| Role-gated buttons in sticky footer | Component | No | Add |
| Autosave state in new footer location | Manual | No | Manual OK |
| Sticky footer overlap on 800x600 | Manual | No | Manual OK |
| Chip keyboard nav (Tab/Enter/Esc) | Manual | No | Manual OK |
| Progress-strip 3-pending -> all-done -> collapse | Manual | No | Manual OK |

### PR Risk Assessment

| PR | Complexity | Regression | Reviewability | Biggest risk |
|----|-----------|-----------|--------------|--------------|
| PR 1 — Reorganize + merge image flows | 4/10 | 5/10 | 8/10 | Merged image flows may skip image_path PUT (:421-426), losing pre-gen image on generate |
| PR 2 — Chip picker + tab restructure | 7/10 | 8/10 | 5/10 | activeTab key format change breaks URL/bookmark; 4x textarea DOM weight per lang pane |
| PR 3 — Status strip + sticky footer + collapsibles | 5/10 | 4/10 | 7/10 | iOS-Safari sticky+caret collision; `<details>` breaks Find-in-Page |

### Eng Failure Modes Registry

| Scenario | Current | New (planned) | Severity |
|----------|---------|---------------|----------|
| Refresh mid-generation | Poll resumes cleanly | Same, but activeLangTab resets to first lang | Medium |
| Network fails during translation | Silent .pending forever | Progress-strip shows x + retry | Low (improvement) |
| Sticky footer + iOS soft keyboard | N/A | Footer floats over caret | Medium |
| 8 langs selected, chip remove | Instant | Local remove but poll keeps waiting (bug at :174) | Medium |
| Legacy URL ?tab=tr:pl:omschrijving | Works | Silently ignored | Medium |
| Restore old-schema _pl snapshot | Migrates | Only works if migration preserved through split | High if forgotten |

### Eng Hidden Complexity (top 5)

1. **Render-phase setState** at VacaturePlaatsen.jsx:118-121. React 19 will warn. Fix in PR 1 regardless.
2. **existingDraftQuery.refetch() inside setInterval** doubles polls in StrictMode.
3. **content useMemo rebuilds full translations tree per keystroke** — memory pressure with 8 langs.
4. **missingTranslations reads loadedDraft.form_data.talen, not form.talen** — chip-remove hits this bug.
5. **VersionHistoryPicker _pl migration lives inline** — a sub-component split may drop it.

### Eng auto-decisions

- Sub-component split into pages/vacature-plaatsen/ folder for PR 1 — REJECT per P5. Split later if needed.
- Shared abstraction with MarketingPost.jsx — DEFER except for hooks (useImagePath, useCriticus).
- New shadcn Popover dependency — REJECT per P4/P5. Roll a 50-line custom listbox.

### Eng "What already exists"

- VersionHistoryPicker modal-backdrop pattern -> reuse for chip picker close-on-outside-click.
- MarketingPost.jsx:44+95 imagePathOverride pattern -> adopt in vacature to fix render-phase setState.
- useAutosaveDraft hook -> already reused, no work.
- .pending tab styling -> generalize into ProgressStrip rows.

---

## Cross-Phase Themes

Multiple voices independently flagged the same concerns across CEO + Design + Eng phases — high-confidence signals:

1. **Chip-picker with hidden popover is wrong.** All 3 phases pushed back. Alternative (visible chip cluster) is unanimous fix.
2. **Sub-component pages/vacature-plaatsen/ split is premature.** CEO calls it scope creep, Eng calls it review-load doubler. Defer until file exceeds ~1200 LoC.
3. **Sticky footer mobile behavior needs a concrete decision, not "punt to implementer".** All phases flagged.
4. **Cross-page consistency risk.** CEO + Eng both flag that MarketingPost, ContentWachtrij, Dashboard need aligned treatment if statusbadge/statustrip primitives are introduced.
5. **Missing states / error handling.** Design + Eng both flag that failure/overflow/partial states are unspecified across new elements.

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale |
|---|-------|----------|---------------|-----------|-----------|
| 1 | CEO | Split PR 2 into 2a (chip) + 2b (tabs) | Auto-decide | P5 (explicit) | Two independent codepaths — bundling hides regressions |
| 2 | CEO | Sub-component folder split — DEFER | Auto-decide | P5 + P3 | Splits add review load without user benefit; do after visual reorg lands |
| 3 | CEO | Contract-as-select — DEFER | Auto-decide | P6 | Touches XML feed contract; needs data audit first |
| 4 | CEO | Sticky mobile — DESKTOP-ONLY | Auto-decide | P3 (pragmatic) | Recruiters primarily desktop; iOS complexity not worth burn |
| 5 | CEO | Fix render-phase setState (:118-121) in PR 1 | Auto-decide | P2 (boil lakes) | React 19 warning; blast radius is this file; <30 min |
| 6 | CEO | Fix missingTranslations reads form.talen not loadedDraft.form_data.talen | Auto-decide | P2 | Real bug; chip-remove exacerbates |
| 7 | Design | Chip-picker as visible cluster (not popover) | **User Challenge** | P5 (explicit affordance) | See gate |
| 8 | Design | Merge criticus box into status-strip | Auto-decide | P5 | Reduces cockpit anxiety without info loss |
| 9 | Design | Statusbadge palette fix (Actief green, Afgekeurd red-with-icon) | Auto-decide | P1 | A11y baseline |
| 10 | Design | Fix truncated criticus notes (max-height:4.5em bug) | Auto-decide | P2 | Pre-existing bug; fix while touching this area |
| 11 | Design | Rename "Uitstraling" -> "Afbeelding" | Auto-decide | P5 | 1-line rename; recruiter-native term |
| 12 | Design | Requirement `*` on field (not section header) | Auto-decide | P5 | Section-header requirement is unusual pattern |
| 13 | Design | 4 fields per lang pane: `<h4>` + natural scroll | Auto-decide | P5 | Accordion inside tab inside preview inside form = nesting hell |
| 14 | Eng | Chip-picker = 50-line custom listbox (not shadcn Popover) | Auto-decide | P4 + P5 | 3 deps vs 50 lines for one use-case |
| 15 | Eng | activeTab URL-param migration for PR 2 | Auto-decide | P1 | Legacy URLs silently break otherwise |
| 16 | Eng | Extract useImagePath + useCriticus hooks (shared with MarketingPost) | Auto-decide | P4 (DRY) | Both pages already duplicate the reconcile logic |
| 17 | Eng | Character counter on document textarea | Auto-decide | P1 | 3-line fix; plan already has counter on korte omschrijving |
| 18 | Design | Status-strip auto-collapses to 1 line when all done | Auto-decide | P3 | Plan already suggested this; confirm |
| 19 | Design | Per-row "opnieuw" icon in progress-strip | Auto-decide | P1 | Preserve existing manual-refresh escape |
| 20 | Cross | Marketing-post inclusion in PRs 2 and 3 | **User Challenge** | (models push back on stated scope) | See gate |
| 21 | Cross | Statusbadge terminology + cross-page rename | **Taste** | P5 vs cross-page scope creep | See gate |

---

## Implementation Tasks (aggregated across phases)

- [ ] **T1 (P1, human: 15 min / CC: 5 min) — CLAUDE.md** — Document that vacature UX plan produced primitives that MarketingPost/ContentWachtrij/Dashboard must adopt when statusbadge lands.
- [ ] **T2 (P1, human: 20 min / CC: 5 min) — VacaturePlaatsen.jsx** — Fix render-phase setState at :118-121 (React 19 warning). Adopt MarketingPost imagePathOverride pattern.
- [ ] **T3 (P1, human: 15 min / CC: 5 min) — VacaturePlaatsen.jsx** — Fix missingTranslations to read form.talen not loadedDraft.form_data.talen.
- [ ] **T4 (P1, human: 30 min / CC: 10 min) — vacature-plaatsen.css + VacaturePlaatsen.jsx** — Fix truncated criticus notes (max-height:4.5em). Add expandable "Toon meer".
- [ ] **T5 (P2, human: 3–4h / CC: 45 min) — PR 1: Section reorg + image flow merge** — 4 `<section>` blocks (Briefing / Vacature-details / Afbeelding / Talen). Merge pre-upload + MediaPicker into unified image block. Rename Uitstraling -> Afbeelding. Move requirement `*` inline. No sub-component split.
- [ ] **T6 (P2, human: 2–3h / CC: 30 min) — PR 2a: Chip-picker (visible cluster, not popover)** — 50-line custom listbox pattern; NL basis with padlock icon; 8 language chips with toggle styling.
- [ ] **T7 (P2, human: 4–6h / CC: 1h) — PR 2b: Tab restructure with URL-param migration** — N tabs per language, 4 fields stacked with `<h4>` + natural scroll. useSearchParams for activeLangTab. Legacy tab-key compat read on mount.
- [ ] **T8 (P2, human: 3–4h / CC: 45 min) — PR 3: Status-strip + statusbadge + sticky footer** — Progress strip replaces criticus box + .pending tabs. Statusbadge palette fix. Sticky footer desktop-only. Per-row retry in progress-strip.
- [ ] **T9 (P3, human: 1h / CC: 15 min) — hooks/** — Extract useImagePath + useCriticus shared with MarketingPost.jsx.
- [ ] **T10 (P3, human: 30 min / CC: 5 min) — VacaturePlaatsen.jsx** — Character counter on document textarea.

---

## User Challenges (both voices agree the stated direction should change)

Three items where both the primary subagent voice and the parent synthesis push back on the plan's stated direction. These are NOT auto-decided — the user has context the models lack, and the default is the plan-as-written unless the user chooses otherwise.

**UC1 — Chip-picker with hidden popover**
- Author said: "+ Taal toevoegen popover / dropdown"
- Both voices recommend: visible one-row chip cluster (8 language chips with toggle styling, no popover)
- Why: Liza-persona (5-min onboarding budget) will not find 8 languages behind "+"; efficiency argument only wins if avg recruiter picks 0-1 extra languages, which is untested
- What we might be missing: the popover is easier to fit visually next to other chips; the assumption of "0-1 extra languages" may actually hold in practice
- If we're wrong the cost is: rebuilding the same chip visual after ship (small)

**UC2 — Marketing-post exclusion**
- Author said: "Marketing-post out of scope, aparte plan-ronde later"
- Both voices recommend: pull marketing-post into PRs 2 and 3 (shared primitives StatusStrip, StickyActions, ChipPicker land on both pages together)
- Why: same form -> preview -> actions shape, shared imports (MediaPicker, PlatformPreview, VersionHistoryPicker, GenerationProgress, useAutosaveDraft); primitives will get re-litigated in 4 weeks
- What we might be missing: marketing-post has 3 tabs (channels, not languages) — the tab-restructure change actually doesn't apply; only chip patterns + status-strip + sticky footer transfer
- If we're wrong the cost is: PR size grows ~40%, one extra week; visible drift between the two pages for a while

**UC3 — Sub-component split into pages/vacature-plaatsen/ folder in PR 1**
- Author said: "Section-per-file component split as risk mitigation for file size"
- Both voices recommend: defer the file split; ship PR 1 as `<section>` blocks in the single file; split only if file exceeds ~1200 LoC after reorg
- Why: splitting during visual reorg doubles review load with zero user-visible benefit; mechanical refactor after new structure is proven is much safer
- What we might be missing: developer preference for smaller files; long-term maintainability
- If we're wrong the cost is: file grows past 1200 LoC and the next-touch is harder (one PR later)

---

## Completion Summary

- Plan **APPROVED with revisions**.
- 18 auto-decisions logged (P1-P5 principles).
- 3 items escalated as User Challenges for gate (see above).
- PR structure revised: PR 1 (reorg) -> PR 2a (chip) -> PR 2b (tabs) -> PR 3 (strip+footer) = 4 PRs, not 3.
- Marketing-post scope decision left to user (UC2).
- Test plan artifact recommended but frontend has minimal test infra today; manual test plan is the primary quality gate.

---

# APPROVED — Post-review revisions

Autoplan afgerond 2026-09-02. Alle 3 User Challenges geaccepteerd door de gebruiker; het originele "Voorstel" en "Migratiepad" blijven als context staan maar worden op onderstaande punten overruled:

## Superseded — chip-picker (UC1)

**Was**: "+ Taal toevoegen ▾" popover met dropdown-menu.
**Is nu**: Visible one-row chip cluster. NL basis-chip met padlock-icoon (visueel duidelijk niet-verwijderbaar), plus 8 taal-chips met toggle-styling (grey-outline = uit, filled-red = aan). Geen popover, geen dropdown, geen hidden state.
**Waarom**: Discoverability voor Liza-persona (5-min onboarding). Zelfde ~90px hoogte-doel wordt gehaald met one-row-of-8-chips.

## Superseded — marketing-post scope (UC2)

**Was**: MarketingPost.jsx expliciet buiten scope; aparte plan-ronde later.
**Is nu**: Primitives die in PRs 2 en 3 landen (chip-cluster patroon voor kanalen ipv talen, StatusStrip, StickyFooter, statusbadge palette) worden **direct** ook op MarketingPost.jsx toegepast in dezelfde PRs. Tab-restructure (PR 2b) geldt alleen voor vacature (MarketingPost heeft 3 kanaal-tabs, geen taal-tabs).
**Waarom**: MarketingPost deelt 5 imports en dezelfde form → preview → actions shape. Primitives twee keer maken = 4 weken later opnieuw redesigen.
**Blast radius**: MarketingPost.jsx, marketing-post.css. Ook ContentWachtrij + Dashboard-statusbadge moeten meelopen (audit + rename).
**Kostenimpact**: PR-scope ~40% groter, ongeveer één extra week.

## Superseded — sub-component split (UC3)

**Was**: `frontend/src/pages/vacature-plaatsen/` folder met Section-per-file.
**Is nu**: PR 1 blijft één `VacaturePlaatsen.jsx` file met `<section>` blocks. File-split wordt aparte PR (PR 1.5) **alleen** als het file >1200 LoC wordt na de reorg. Het originele risico ("meer code in één file") wordt aanvaard.
**Waarom**: Splitsen tijdens visuele reorg verdubbelt review-load zonder gebruiker-zichtbaar voordeel. Mechanische refactor na bewezen structuur is veel veiliger.

## Bijgestelde PR-volgorde (definitief)

1. **PR 1** — Section-reorg + image-flow merge + inline bug-fixes:
   - 4 `<section>` blokken: Briefing / Vacature-details / Afbeelding / Talen
   - Merge pre-upload + MediaPicker naar één image-block
   - Rename "Uitstraling" → "Afbeelding"
   - Verplicht `*` inline op velden (niet op section-header)
   - Fix render-phase setState (:118-121) — adopt MarketingPost `imagePathOverride` pattern
   - Fix `missingTranslations` reads `form.talen` (:174)
   - Fix truncated criticus notes (max-height:4.5em)
   - Character counter op document-textarea
   - **Geen sub-component split**

2. **PR 2a** — Chip-picker (visible cluster):
   - 50-line custom listbox pattern; geen shadcn/Popover dependency
   - NL basis met padlock-icoon
   - 8 language-chips met toggle-styling
   - Ook toepassen op MarketingPost kanaal-selectie (kanalen ipv talen)

3. **PR 2b** — Tab restructure (vacature-only):
   - N tabs per taal, 4 velden gestackt met `<h4>` + natural scroll
   - `useSearchParams` voor `activeLangTab`
   - Legacy tab-key compat read on mount
   - MarketingPost tab-structuur ongewijzigd (3 kanaal-tabs blijven)

4. **PR 3** — Status-strip + statusbadge + sticky footer (beide pagina's):
   - Progress-strip vervangt criticus-box + `.pending`-tabs
   - Criticus wordt een row in de strip; failure expands inline
   - Statusbadge palette: Concept=grijs, Ingediend=oranje/geel, Goedgekeurd=groen, Actief=green-with-dot, Afgekeurd=red-with-icon (never color-only)
   - Sticky footer **desktop-only** (mobiel: inline)
   - Per-row "↻ opnieuw" icoon in progress-strip (preserve manual-refresh escape)
   - Auto-collapse van strip naar 1 line "✓ Alles klaar" als alles klaar is
   - Toepassen op **beide** pagina's (vacature + marketing-post)
   - Statusbadge terminologie ook doortrekken naar ContentWachtrij + Dashboard

5. **PR 3.5 (optioneel, laatste)** — File-split als VacaturePlaatsen.jsx >1200 LoC:
   - Extract per section naar sub-components
   - Extract `useImagePath` + `useCriticus` shared hooks

## Deferred (in TODOS, niet in scope voor deze PRs)

- Contract-as-select (behoeft feed-contract audit met Jobit)
- Onboarding-tour voor nieuwe recruiters
- Toets-shortcuts voor tab-navigatie
- Bulk-genereren
- Vertaling-review workflow

## Status

**APPROVED for implementation.** Ready to start met PR 1. Roep `/ship` aan zodra PR 1 klaar staat.

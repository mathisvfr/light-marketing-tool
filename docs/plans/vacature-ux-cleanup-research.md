# Vacature UX Cleanup — Research Pass

Companion document to `vacature-ux-cleanup.md`. Bevat de ruwe file:line-
bevindingen uit de research-ronde (Explore agent, 2026-09-02).

---

## 1. Huidige page-anatomie (visuele volgorde)

Alle regelnummers verwijzen naar `frontend/src/pages/VacaturePlaatsen.jsx`
tenzij anders vermeld.

1. **Autosave indicator** (regels 519–527)
   - Altijd zichtbaar wanneer `effectiveDraftId` bestaat.
   - Toont: `Opslaan...`, foutmelding, of `Zojuist opgeslagen` / `Opgeslagen
     Xm geleden`.
   - Eén regel, gedempte kleur, minimaal visueel gewicht.

2. **Form grid: quick fields** (regels 528–565)
   - 2-koloms grid op desktop, 1-koloms op mobiel (media query op 900px).
   - Velden: Functietitel (verplicht), Locatie, Uren per week (verplicht),
     Startdatum (optioneel).

3. **Korte omschrijving** (regels 567–577)
   - Full-width textarea, 6 rijen.
   - Conditioneel label-suffix `(optioneel — document geüpload)` als
     `documentText` waarheid is.
   - Tekenteller onderaan `X/2000 tekens`.
   - Verplicht als geen document; optioneel als document geüpload.

4. **Klantbriefing/Document upload** (regels 579–618)
   - Full-width, conditioneel two-state block.
   - State A (geen document): file input + help "Upload een .docx of .pdf..."
   - State B (document geladen): `vacature-doc-block` met meta, editable
     textarea (8 rijen), help.
   - Toont filename, char count, "Document verwijderen"-knop.

5. **Visualisatie (template picker)** (regels 620–634)
   - 2 radio-achtige buttons in `.vacature-language` flex row.
   - Opties: "Vacaturekaart (feed)" (vacancy), "Story (verticaal, Instagram)"
     (story).

6. **Talen (language checkboxes)** (regels 636–669)
   - Header + full-width list.
   - Vaste badge: "Nederlands (basis)" met primary red bg.
   - 8 optionele checkboxes: PL, BG, SK, LV, EN, HU, RO, UK.
   - Elke checkbox-label toont NL-naam + native taal.
   - Helper: "Nederlands is altijd de basis. Extra talen worden op de
     achtergrond gegenereerd..."

7. **Contract** (regels 671–679) — full-width, verplicht, placeholder "Bijv.
   Fulltime".
8. **Salaris** (regels 681–688) — full-width, optioneel, lange placeholder
   "Bijv. €14,- p/u of conform CAO (leeg = conform CAO)".
9. **Sollicitatie URL** (regels 690–698) — full-width, optioneel, type="url".
10. **E-mailadres sollicitaties** (regels 700–708) — full-width, optioneel,
    type="email".
11. **Eigen afbeelding** (regels 710–719) — full-width file input, optioneel.
12. **Pre-upload image preview** (regels 724–736) — conditioneel: alleen als
    `imagePath && !effectiveDraftId`.
13. **Form actions button row** (regels 738–742) — enkele knop "Concept
    genereren".
14. **GenerationProgress skeleton** (regel 745) — phased indicator
    (Merkcontext → AI schrijft → Opslaan).

15. **Preview sectie** (regels 747–916) — conditioneel: alleen als
    `effectiveDraftId && !isGenerating`.
    - a. Criticus box (751–758) — pass/fail variant, notes truncated op 4.5em.
    - b. Regenerate steering box (760–778) — muted bg, textarea 2 rijen +
         "Opnieuw genereren"-knop.
    - c. VersionHistoryPicker (780–808) — dropdown + modal, alleen als
         history bestaat.
    - d. Preview tabs (810–833) — flex-wrap, 4 NL + N×4 vertaling, pending
         state, refresh-knop rechts.
    - e. Preview pane textarea (835–865) — full-width, min 220px, met
         "Kopieer tekst"-knop.
    - f. Vacature image block (867–890) — bordered top, MediaPicker button.
    - g. MediaPicker modal (892–896) — apart component.
    - h. Final action buttons row (898–914) — Opslaan / Indienen / Goedkeuren
         (role-based).

16. **Error/success messages** (regels 918–919) — global toast onderaan.

---

## 2. Interactie-flow (happy path: recruiter met NL+PL vacature + document)

Stapsgewijs, wat de recruiter ziet en wat er sync/async op de achtergrond
gebeurt.

1. Land op `/vacature-plaatsen` (geen draftId). Leeg formulier met defaults
   (locatie=Rotterdam, email=vacature@...). Preview sectie verborgen. Geen
   autosave-indicator.

2. Vul quick fields (functietitel, uren). `formEdits` update via
   `updateField()`.

3. Upload document (.docx/.pdf). `handleDocumentUpload` (regels 298–357):
   - `readAsDataURL` → POST `/api/uploads/extract-text`.
   - Backend haalt tekst eruit + auto-fillt beschikbare velden.
   - Frontend past patch toe ALLEEN op lege velden (isEmpty check regel 340).
   - Document-UI schakelt naar State B: editable textarea + meta.
   - Success-toast: `Document ingelezen. Automatisch ingevuld: [namen]`.

4. Review/edit extracted data + document tekst.

5. Selecteer extra talen (PL + BG). Frontend: `selectedLangs` update →
   `useMemo(() => createTabs(...))` voegt 8 tabs toe (verschijnen pas na
   genereren).

6. Kies template. Update `form.template`.

7. Vul overige velden (contract, salaris, etc.).

8. Klik "Concept genereren". `handleGenerate` (regels 364–457):
   - Valideer: korte omschrijving ≤ 2000 chars, en (korte omschrijving OR
     documentText), en contract verplicht.
   - Als geen draftId: POST `/api/drafts` → krijg `draft.id`. Frontend:
     `setDraftId`.
   - Merge korte omschrijving + documentText + steering notes in één blob.
   - Als `imagePath` gezet (pre-upload): PUT image_path eerst.
   - POST `/api/drafts/:id/generate` met merged formData.
     - Backend: `claude.generate()` sync (NL alleen).
     - Backend: `translateVacature()` async gespawned per taal — geen await.
     - Backend: `criticus()` async gespawned — geen await.
     - Backend: `renderSocialImage()` async gespawned — geen await.
     - Returnt draft met NL velden.
   - Frontend zet `contentEdits` op NL-content. `setActiveTab('omschrijving_nl')`.

9. UI transitie naar preview. Form blijft zichtbaar; preview verschijnt met:
   - Criticus box skeleton "Criticus controleren..." (`criticusPassed === null`).
   - Regenerate steering box.
   - VersionHistoryPicker (leeg).
   - 4 NL tabs + 8 PL/BG tabs met `.pending` (opacity 0.6, cursor progress).
   - "↻ Ververs vertalingen"-knop.
   - Lege preview pane.
   - Image block (leeg tot Satori rendert).
   - Actie-knoppen.

10. Polling start (regels 184–227). useEffect wanneer criticusPassed=null OR
    imagePath leeg OR missingTranslations.length > 0. Polls `/api/drafts/:id`
    elke 3s, tot 200 iteraties (10 min cap).

11. Vertalingen komen één voor één binnen (async backend tasks). Poll pickt
    ze op, tabs verliezen `.pending`.

12. Image rendert (Satori) → poll detecteert `image_path` → preview image
    verschijnt.

13. Criticus resultaat komt binnen → poll detecteert → box wordt groen/rood.

14. Recruiter reviewt tabs, klikt door, edit inline (local state).

15. Optioneel: regenereer met steering. Repeat step 8.

16. Klik "Opslaan als concept". `handleSaveDraft` → `saveMutation`. PUT
    `/api/drafts/:id`. Toast "Concept opgeslagen".

17. Klik "Indienen ter goedkeuring" (recruiter). handleSubmitForApproval:
    save + POST `/api/drafts/:id/submit`. Status → `pending_approval`.

18. Owner navigeert er heen (uit wachtrij), ziet preview, klikt "Goedkeuren".
    Status → `actief`. Verschijnt in `/feeds/jobs.xml`.

---

## 3. Concrete crowding sources (met file:line)

Cognitieve last-issues die uit de code springen:

1. **Language checkbox block visueel dominant** (regels 636–669) — 9 checkboxes
   inline wrappend, ~250px vertikaal desktop, meer op mobiel. Onduidelijk welk
   verplicht/optioneel is.

2. **Dual upload states voor document** (regels 579–618) — twee compleet
   verschillende UIs op één bool. State-transitie is schokkerig; onduidelijk
   wat gebeurt als je document wil wisselen.

3. **Form grid breekt asymmetrisch** (regels 528–565) — 2-koloms grid
   ["Functietitel | Locatie"] gevolgd door 5+ full-width velden.
   Cognitieve wissel tussen grid- en flow-context.

4. **Korte omschrijving toggle requirement dynamisch** (regel 574) —
   `required={!documentText}`, label krijgt suffix. Geen visuele change; enkel
   label-tekst update.

5. **Character counter alleen op omschrijving** (regel 576) — document-textarea
   heeft geen counter, terwijl die ook editable is.

6. **Template picker heeft custom button-styling** (regels 620–634) — lijkt op
   toggle-buttons maar zijn radio-semantiek. Affordance ontbreekt.

7. **Salaris placeholder erg lang** (regel 686) — "€14,- p/u of conform CAO
   (leeg = conform CAO)". Business-logica in placeholder verstopt.

8. **Twee aparte image-upload flows** (regels 710–736 en 867–890) — pre-upload
   in formulier + MediaPicker in preview. Beide `imagePath`. Pre-upload
   preview alleen zichtbaar als `imagePath && !effectiveDraftId`.

9. **Polling UI is stil** (regels 184–227) — geen zichtbare progress voor
   vertalingen, image, criticus. Alleen tabs veranderen. Refresh-knop
   verschijnt maar onduidelijk of klik helpt.

10. **Translation tabs overweldigend** (regels 54–75, 810–833) — 4 talen = 16
    tabs. Tabs wrappen; sommige pending. Onbruikbaar met toetsenbord.

11. **Criticus box truncates overflow** (regel 375) — `max-height: 4.5em;
    overflow: hidden`. Belangrijke feedback stil weggeknipt.

12. **Regenerate steering box low-contrast** (regels 760–778) — grey-100 bg,
    voelt als "advanced". Button `align-self: flex-start`, mogelijk niet
    visueel geassocieerd met textarea.

13. **Form actions duplicated/inconsistent** (regels 738–742 vs 898–914) —
    één knop bovenaan, drie onderaan. Geen visuele hiërarchie of statusbadge.

14. **Geen inline validation feedback** — errors als global toast (regel 918).
    Geen wijziging bij offending veld.

15. **Autosave indicator passief** (regels 520–526) — small text muted. Geen
    duidelijke succes/fout-signaal.

---

## 4. Herbruikbare patronen (met paths)

**Bestaande primitives:**

- **Tab-systeem** — `vacature-plaatsen.css` regels 230–259, mirror in
  `marketing-post.css`. Pattern: `.preview-tabs` flex-container met knoppen,
  `.active`/`.pending`. Gebruikt voor: taal/platform content-switching.

- **Modal confirmation** — `VersionHistoryPicker.jsx` regels 87–117. Backdrop
  + modal, click-outside sluit, confirm/cancel-knoppen. Gebruikt voor
  destructieve acties.

- **Skeleton loading** — `vacature-plaatsen.css` regels 358–363 (`.skeleton`).
  Grey-100 bg, dashed border, padding.

- **Autosave indicator** — `useAutosaveDraft.js` +
  `vacature-plaatsen.jsx:520–526`. Debounced PATCH, toont saving/error/saved-at.
  Gebruikt in beide vacature- én marketing-post pagina's.

- **Polling** — `MarketingPost.jsx:118–152` (8 iteraties, 2s). Vacature
  gebruikt 200 iteraties/3s (10 min). Inconsistent.

- **Copy-to-clipboard** — `vacature-plaatsen.jsx:854–864`.
  `navigator.clipboard.writeText()` + state-toggle voor feedback.

**Sibling pages voor vergelijking:**

- **MarketingPost.jsx** — zelfde form→preview→actions shape, maar 4
  formuliervelden ipv 11. Preview: 3 kanaal-tabs ipv 16+ vertaal-tabs.
- **ContentWachtrij.jsx** — tabellen ipv formulier. Bulk-acties losgekoppeld
  van individuele acties.
- **Dashboard.jsx** — onboarding-sectie voor nieuwe users; scheidt
  first-time complexity.

---

## 5. Design-system inventory

**Tokens (frontend/src/styles/tokens/*.css):**

- **Colors**: `--color-primary` (#be1e2d), `--color-text{,-muted,-subtle}`,
  `--color-bg{,-soft,-muted}`, `--color-border{,-strong}`, semantic success/
  attention/info.
- **Spacing**: --space-1 (4px) t/m --space-24 (96px).
- **Radius**: sm (6px), md (10px), lg (16px), pill (999px).
- **Typography**: --font-display, --font-body, --font-mono.
- **Motion**: --dur-fast (140ms), --dur-base (220ms), --dur-slow (360ms),
  --ease-out, --ease-inout.
- **Shadows**: --shadow-xs, --shadow-red (CTA glow).

**Componentvarianten:**

- Buttons: `.form-actions button` (primary red).
- Checkboxes: `.vacature-lang-check` custom-styled (niet native).
- Tabs: `.preview-tabs button` (mimic buttons, geen native `<Tab>`).
- Textareas: `.vacature-field textarea` (1.5px border, focus ring).

**Gaps/beperkingen:**

- Geen collapsible/accordion (nodig voor talen-picker of steering-blok).
- Geen multi-step wizard (niet gewenst voor deze pagina).
- Geen algemene progress-indicator voor async taken (GenerationProgress is
  simpel).
- Geen badge/chip voor taal-indicators.
- Geen popover/tooltip voor field-hints.
- Geen native radio/checkbox-framework (custom per pagina).

---

## 6. Open vragen (uit research)

Deze zijn overgenomen in het hoofdplan-document onder "Open vragen (voor
review)" met een concreet voorstel per stuk.

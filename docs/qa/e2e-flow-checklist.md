# QA-checklist: end-to-end flow-verificatie

Loop deze checklist handmatig door vóór een release. Dekt beide contentketens van
formulier tot gepubliceerde status. De geautomatiseerde tegenhanger staat in
`backend/test/flow.test.js` (`npm test`), maar deze lijst controleert ook de UI:
statusbadges, Content wachtrij en Gepubliceerd.

Log in als **owner** tenzij anders vermeld. Noteer per stap of de statusbadge en de
lijstweergaven kloppen.

## A. Vacature (Type A → XML feed)

1. **Aanmaken** — Vacature plaatsen: vul Functietitel, Locatie (Rotterdam),
   Uren/week, Korte omschrijving, Taal (NL of NL+PL), Contract. Klik "Concept
   genereren".
   - [ ] Skeleton "Concept wordt gegenereerd..." verschijnt.
2. **Genereren** — binnen ~10s verschijnt gestructureerd concept (tabs per veld,
   ook PL bij NL+PL).
   - [ ] Criticus-uitslag verschijnt (akkoord / aandacht nodig) zonder handmatige
     refresh.
   - [ ] Afbeelding verschijnt in de preview zonder refresh (poll losgekoppeld van
     criticus).
3. **Eigen afbeelding vóór generatie** (optioneel pad) — herhaal met een geüploade
   foto in "Eigen afbeelding (optioneel)".
   - [ ] Geüploade foto wordt gebruikt; er wordt géén Satori-afbeelding
     overschreven.
4. **Bewerken** — pas een veld aan, "Opslaan als concept".
   - [ ] Content wachtrij toont de vacature als `draft`, juiste auteur/type-badge.
5. **Indienen** (test ook als **recruiter** met eigen concept) → status
   `pending_approval`.
   - [ ] Owner ziet het item in de goedkeuringswachtrij op het Dashboard.
6. **Goedkeuren** (owner) → status `actief`.
   - [ ] Statusbadge wordt `actief`.
7. **Feed** — open `/feeds/jobs.xml` (of `feed.<domein>`/feeds/jobs.xml).
   - [ ] Vacature staat erin, elk veld in CDATA, Plaats = één plaatsnaam.
8. **Sluiten** — Gepubliceerd → "Vacature sluiten" → status `expired`.
   - [ ] Vacature verdwijnt uit `/feeds/jobs.xml`.

## B. Marketingpost (Type B → Buffer)

1. **Aanmaken** — Marketing post: Onderwerp, Type (Opdrachtgevers/Kandidaten),
   Kanalen (LinkedIn/Facebook/Instagram). Alleen gekoppelde kanalen zijn
   selecteerbaar.
2. **Genereren** — teksten per gekozen kanaal + branded afbeelding.
   - [ ] Criticus-uitslag verschijnt zonder refresh.
   - [ ] **Instagram**: bij Instagram-selectie is de afbeelding vierkant (1080×1080)
     en zichtbaar in de preview (niet bijgesneden).
   - [ ] Afbeelding is zichtbaar op elke kanaal-tab.
3. **Eigen afbeelding vóór generatie** — upload een foto vóór "Concept genereren".
   - [ ] De geüploade foto wordt gebruikt i.p.v. een gegenereerde afbeelding.
4. **Bewerken** — pas tekst aan; wissel eventueel de afbeelding via
   "Afbeelding kiezen uit bibliotheek".
5. **Indienen/Goedkeuren** — owner: "Goedkeuren en publiceren".
   - [ ] Bij ontbrekende kanaalkoppeling: duidelijke NL-foutmelding, geen crash.
6. **Publiceren via Buffer** — per gekozen kanaal.
   - [ ] Gepubliceerd toont per-kanaal status (groen/rood/ingepland).
   - [ ] Bij gedeeltelijke fout: succesvolle kanalen groen, mislukte rood met
     reden.
7. **Opnieuw publiceren** — als een kanaal faalde, "Opnieuw publiceren".
   - [ ] Alleen de betrokken kanaal-rijen worden bijgewerkt.

## C. Rol-gedrag (steekproef)

- [ ] **viewer**: kan geen concepten aanmaken/bewerken (alleen-lezen banner).
- [ ] **recruiter**: kan indienen maar niet goedkeuren/publiceren; ziet/bewerkt
  alleen eigen concepten.
- [ ] **owner**: volledige toegang.

## D. Randgevallen

- [ ] AI geeft ongeldige JSON → één retry, daarna NL-foutmelding.
- [ ] Sessie verlopen → 401, terug naar login.
- [ ] Lege feed (geen actieve vacatures) → geldige, lege XML.

# Light Marketing Tool — Go-Live Checklist

Praktische afvinklijst om van "server draait" naar "gebruikers publiceren echt"
te komen. Volgorde is logisch; sla niets over dat als **blokkerend** gemarkeerd
staat. Status van vandaag (2026-07-14):

- [x] Server draait op Hetzner (Docker Compose + Caddy)
- [x] Buffer-kanalen gekoppeld en publicatie getest (LinkedIn/Facebook/Instagram)
- [x] Multiposter XML-feed getest (pull werkt)

---

## 1. Blokkerend — moet af vóór echte publicatie

### 1.1 AI-provider werkt op de server
Contentgeneratie + Criticus zijn de kern van de tool en hebben een geldige key nodig.
- [ ] `.env` op de VPS heeft een werkende provider. Standaard is `AI_PROVIDER=gemini`
      → `GOOGLE_AI_STUDIO_API_KEY` moet gezet zijn (of switch naar `anthropic` +
      `ANTHROPIC_API_KEY`, of `greenpt` + `GREENPT_API_KEY`).
- [ ] Genereer op de live server **één vacature** en **één marketingpost**;
      bevestig dat generatie **én** de Criticus-check draaien (geen 500/timeout).

### 1.2 Owner-login gehard
- [ ] Inloggen als owner werkt op `https://tool.lightpersoneelsdiensten.nl`.
- [ ] Seed-wachtwoord **direct wijzigen** via Gebruikers (het staat als
      `SEED_OWNER_PASSWORD` in `.env` en mag niet het live-wachtwoord blijven).

### 1.3 Beide subdomeinen groen over HTTPS
- [ ] `https://tool.lightpersoneelsdiensten.nl/api/health` → `{"status":"ok"}`
- [ ] `https://feed.lightpersoneelsdiensten.nl/feeds/jobs.xml` → XML, status 200
- [ ] Caddy heeft geldige certs voor beide subdomeinen (check `logs -f caddy`).

### 1.4 Secrets compleet en veilig
- [ ] `JWT_SECRET` gezet en stabiel (verandert niet bij herstart).
- [ ] `CREDENTIALS_ENCRYPTION_KEY` gezet (versleutelt Buffer/WordPress-credentials).
- [ ] `.env` op de VPS heeft `chmod 600` en staat niet in git.
- [ ] Elke key die ooit in een terminal/log verscheen is geroteerd.

---

## 2. Blokkerend — één echte end-to-end pass per live kanaal

### 2.1 Vacature (Type A → feed → Multiposter)
- [ ] Maak een echte vacature, keur goed → status `actief`.
- [ ] Vacature verschijnt in `feeds/jobs.xml`.
- [ ] Multiposter pullt hem en toont hem correct (velden goed gemapt).
- [ ] Zet de vacature op `expired` → verdwijnt uit de feed na de volgende sync.

### 2.2 Marketingpost (Type B → Buffer)
- [ ] Maak een marketingpost met branded afbeelding, keur goed.
- [ ] Buffer plaatst/plant hem in op LinkedIn/Facebook/Instagram.
- [ ] Bevestig dat de post **echt landt** op het platform (niet alleen "success"
      in de tool). Let bij Instagram op dat de afbeeldings-URL publiek over HTTPS
      bereikbaar is (`PUBLIC_APP_URL`/`APP_BASE_URL`).

---

## 3. Beslissing — hoort WordPress bij Release 1?

`WORDPRESS_URL` / `WORDPRESS_APP_PASSWORD` zijn nu leeg.
- [ ] **Ja, blogs mee in launch:** vul WordPress-gegevens, test verbinding onder
      Merk instellingen, publiceer één testblog.
- [ ] **Nee, later:** ship vacatures + social als Release 1. Niets anders hangt
      hiervan af (Roadmap staat dit expliciet toe).

---

## 4. Vóór overdracht aan de echte gebruikers

### 4.1 Merkkennis definitief
- [ ] Luke heeft `brand/brand-knowledge.md` gereviewd en akkoord gegeven
      (dit is de kwaliteitsgate voor élke gegenereerde post).

### 4.2 Training
- [ ] Korte walkthrough met Sandra/owner (opnemen).
- [ ] Eén-A4 NL-spiekbriefje klaar.

### 4.3 Rollen gecontroleerd
- [ ] Recruiter kan wél indienen, níet publiceren.
- [ ] Viewer is alleen-lezen.
- [ ] Laatste owner kan niet verwijderd/gedegradeerd worden.

---

## 5. Bekende stubs (geen blokker voor launch)

- [ ] Jobit/Multiposter **statistiek-methode** nog onbevestigd → stats-dashboard
      blijft stub tot bekend. Launch kan zonder.
- [ ] Feed Basic Auth staat bewust **uit** (publieke feed) voor de eerste pull;
      pas later aanzetten als Multiposter Basic Auth aantoonbaar ondersteunt.

---

## Snelle verificatiecommando's

Op de VPS:

```bash
# stack-status
docker compose -f docker-compose.yml ps

# health van de app
curl -s https://tool.lightpersoneelsdiensten.nl/api/health

# feed levert XML
curl -s https://feed.lightpersoneelsdiensten.nl/feeds/jobs.xml | head

# cert-uitgifte / reverse proxy
docker compose -f docker-compose.yml logs -f caddy
```

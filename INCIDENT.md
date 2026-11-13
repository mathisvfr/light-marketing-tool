# Incident Response Playbook — Light Marketing Tool

## Severity levels

| Level | Definitie | Reactietijd | Voorbeeld |
|-------|-----------|-------------|-----------|
| **S1** | Tool volledig onbereikbaar | < 1 uur | VPS down, Caddy crashed, database onbereikbaar |
| **S2** | Kernfunctie kapot | < 4 uur | Generatie faalt, publicatie naar Buffer mislukt |
| **S3** | Cosmetisch / niet-blokkerend | Volgende werkdag | Stijlfout, verkeerde tekst, trage pagina |

## Eerste-responder checklist (S1/S2)

1. **Check health endpoint:**
   ```bash
   curl -s https://tool.lightpersoneelsdiensten.nl/api/health | jq .
   ```
   Als dit niet bereikbaar is → VPS of Caddy probleem.

2. **Check Docker containers:**
   ```bash
   ssh light 'cd /opt/light-marketing-tool && docker compose ps'
   ```
   Kijk naar status: `healthy`, `unhealthy`, `restarting`, of `exited`.

3. **Check logs van het falende component:**
   ```bash
   ssh light 'cd /opt/light-marketing-tool && docker compose logs --tail 50 backend'
   ssh light 'cd /opt/light-marketing-tool && docker compose logs --tail 50 caddy'
   ```

4. **Check Supabase status:** https://status.supabase.com

5. **Check schijfruimte:**
   ```bash
   ssh light 'df -h / && du -sh /opt/light-marketing-tool/backend/uploads'
   ```

## Rollback procedure

Als een recente deploy het probleem veroorzaakt:

```bash
ssh light
cd /opt/light-marketing-tool
git log --oneline -5                    # vind de laatste werkende commit
git checkout <commit-hash>              # ga terug
docker compose up -d --build            # herbouw en herstart
```

## Herstart zonder rollback

```bash
ssh light 'cd /opt/light-marketing-tool && docker compose restart'
```

Of voor een volledige rebuild:

```bash
ssh light 'cd /opt/light-marketing-tool && docker compose down && docker compose up -d --build'
```

## Communicatie

| Wie | Hoe | Wanneer |
|-----|-----|---------|
| Eigenaar (Martijn) | WhatsApp / telefoon | S1: direct, S2: binnen 1 uur |
| Gebruikers (Luke, Sandra, etc.) | WhatsApp-groep | S1: "Tool tijdelijk offline, we werken eraan" |
| Na herstel | Zelfde kanalen | "Tool is weer bereikbaar" + korte uitleg |

## Post-mortem template

Na elk S1/S2-incident, vul dit in en bewaar in `docs/incidents/`:

```markdown
# Incident: [korte titel]
- **Datum:** YYYY-MM-DD HH:MM
- **Duur:** X minuten/uren
- **Severity:** S1/S2
- **Impact:** Wat konden gebruikers niet doen?

## Tijdlijn
- HH:MM — Probleem gedetecteerd (hoe?)
- HH:MM — Eerste diagnose
- HH:MM — Fix toegepast
- HH:MM — Bevestigd werkend

## Oorzaak
Wat ging er mis en waarom?

## Wat voorkomen we hiermee
Welke actie voorkomt herhaling?

## Actiepunten
- [ ] ...
```

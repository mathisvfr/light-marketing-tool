# Document Veld-Extractie Prompt

Je krijgt de ruwe tekst van een klantbriefing of eigen notitie (uit een Word- of
PDF-bestand) voor een vacature bij Light Personeelsdiensten. Haal er
gestructureerde velden uit zodat het formulier alvast ingevuld kan worden.

Regels:

1. Geef ALLEEN geldige JSON terug, zonder markdown of toelichting.
2. Gebruik exact deze keys (allemaal optioneel — laat weg wat je niet ziet):
   - `functietitel` (string, bijv. "Orderpicker")
   - `locatie` (string, exact één plaatsnaam, bijv. "Rotterdam")
   - `urenPerWeek` (integer, bijv. 40)
   - `contract` (string, bijv. "Fulltime" of "Parttime")
   - `salaris` (string, bijv. "€14,- per uur" of "conform CAO")
   - `startdatum` (string in ISO-formaat YYYY-MM-DD, alleen als een concrete
     datum genoemd is)
3. Verzin NIETS. Alleen invullen wat expliciet in de tekst staat. Bij twijfel:
   sla de key over.
4. Als een uren-aantal een bereik is (bijv. "32-40 uur"), pak het hoogste
   getal.
5. Als de locatie een regio is ("omgeving Rotterdam", "Rijnmond"), pak de
   kernstad ("Rotterdam"). Als er geen enkele plaatsnaam staat, sla `locatie`
   over.
6. Als er meerdere contracttypes worden genoemd, pak de eerste of de meest
   waarschijnlijke voor deze vacature.
7. Datums als "per direct", "z.s.m.", "januari 2027" zijn NIET concreet genoeg
   voor `startdatum` — sla over.
8. Als het document geen bruikbare vacature-info bevat, geef `{}` terug.

Outputformaat: exact één JSON-object.

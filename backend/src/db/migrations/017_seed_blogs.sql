-- 017_seed_blogs: Migrate 9 existing static blog articles from the website into the drafts table.
-- These were originally markdown files in light-website/far-flare/src/content/blog/.
-- After this migration, the website reads blogs from Supabase instead of static files.

INSERT INTO drafts (id, type, status, form_data, blog_titel, blog_html, created_at, updated_at)
VALUES

-- 1. uitzendkracht-inzetten-productie
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Uitzendkrachten inzetten in de productie","categorie":"Uitzendwerk","teaser":"Van inwerken tot planning bij piekdrukte: vijf punten die bepalen of een uitzendkracht op dag één productief is.","lead":"Een uitzendkracht is pas van waarde als de eerste dag goed verloopt. Wij zien in de praktijk dat de inzet vrijwel altijd staat of valt met de voorbereiding op de werkvloer.","meta_description":"Vijf punten die bepalen of een uitzendkracht op dag één productief is in uw productieomgeving.","leestijd":"4 min","author":"Sanne de Vries","authorRole":"Intercedent","slug":"uitzendkracht-inzetten-productie","image_url":"https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=700&q=70"}'::jsonb,
 'Uitzendkrachten inzetten in de productie: waar let je op?',
 '<h2>Begin bij een scherpe functieomschrijving</h2><p>Hoe concreter de taken, de werktijden en het gewenste werktempo, hoe beter wij kunnen matchen. Een omschrijving die alleen "productiemedewerker" zegt, levert kandidaten op die alle kanten op kunnen. Benoem het type lijn, het gewicht dat getild wordt, de temperatuur in de hal en of er in ploegen wordt gewerkt.</p><h2>Regel het inwerken vóór de eerste dag</h2><p>Een vaste contactpersoon op de vloer, een korte instructie en werkkleding die klaarligt schelen in de praktijk dagen aan opstarttijd. Wij bespreken vooraf met de kandidaat wat hij of zij kan verwachten, zodat de verwachtingen aan beide kanten kloppen.</p><h2>Plan pieken op tijd in</h2><p>Bij seizoenspieken is twee weken vooruit plannen het verschil tussen een volledige bezetting en halve lijnen. Omdat wij onze pool persoonlijk kennen, kunnen wij snel schakelen, maar de beste match ontstaat met voorbereidingstijd.</p><h2>Houd de administratie strak</h2><p>Urenregistratie, verlof en ziekmeldingen lopen bij ons via één aanspreekpunt. Dat scheelt uw planner werk en voorkomt discussies achteraf over gewerkte uren.</p>',
 '2026-08-28T10:00:00Z', now()),

-- 2. sna-keurmerk-wat-betekent-het
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Wat het SNA-keurmerk betekent","categorie":"Wet- en regelgeving","teaser":"Het keurmerk van Stichting Normering Arbeid beperkt uw aansprakelijkheid. Wij leggen uit hoe de controle werkt.","lead":"Wie personeel inleent, is medeverantwoordelijk voor de afdracht van loonheffingen en omzetbelasting. Het SNA-keurmerk is de manier waarop u dat risico beperkt.","meta_description":"Het SNA-keurmerk beperkt uw inlenersaansprakelijkheid. Zo werkt de controle.","leestijd":"5 min","author":"Mark Hoogeveen","authorRole":"Administratie","slug":"sna-keurmerk-wat-betekent-het","image_url":"https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=700&q=70"}'::jsonb,
 'Wat het SNA-keurmerk betekent voor u als opdrachtgever',
 '<h2>Waarop wordt gecontroleerd?</h2><p>Een SNA-inspectie kijkt naar de identificatie van medewerkers, het gerechtigd zijn tot arbeid in Nederland, de juiste loonbetaling volgens de cao en de tijdige afdracht van belastingen en premies. De inspectie vindt twee keer per jaar plaats door een onafhankelijke instelling.</p><h2>Vrijwaring bij inlenersaansprakelijkheid</h2><p>Leent u in bij een SNA-geregistreerd bedrijf en betaalt u een deel van de factuur op de g-rekening, dan bent u onder voorwaarden gevrijwaard van de inlenersaansprakelijkheid. Dat is de belangrijkste reden dat grote opdrachtgevers het keurmerk als harde eis stellen.</p><h2>Controleer het register zelf</h2><p>De registratie is openbaar. Vraag altijd naar de verklaring van registratie en controleer de geldigheidsdatum. Onze eigen verklaring staat onderaan iedere pagina.</p>',
 '2026-08-19T10:00:00Z', now()),

-- 3. solliciteren-zonder-ervaring
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Solliciteren zonder werkervaring","categorie":"Voor werkzoekenden","teaser":"Geen cv? Geen probleem. Dit is wat opdrachtgevers écht van je vragen bij een eerste baan in het magazijn.","lead":"In de logistiek telt houding zwaarder dan een diploma. Wij plaatsen regelmatig mensen die nog nooit in een magazijn hebben gewerkt.","meta_description":"Solliciteren zonder ervaring in de logistiek. Dit is wat opdrachtgevers écht vragen.","leestijd":"3 min","author":"Ilona Bakker","authorRole":"Recruitment","slug":"solliciteren-zonder-ervaring","image_url":"https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=700&q=70"}'::jsonb,
 'Solliciteren zonder werkervaring: zo begin je in de logistiek',
 '<h2>Wat wél telt</h2><p>Op tijd komen, je afspraken nakomen en kunnen samenwerken. Dat zijn de drie dingen waar iedere opdrachtgever naar vraagt als wij bellen over een kandidaat. Ervaring leer je in een week, betrouwbaarheid niet.</p><h2>Zet je beschikbaarheid duidelijk neer</h2><p>Kun je in ploegen werken? Ben je op korte termijn beschikbaar? Heb je eigen vervoer voor de vroege dienst? Zet dit bovenaan je reactie: het bepaalt vaak of je diezelfde week aan de slag kunt.</p><h2>Certificaten die snel lonen</h2><p>Een heftruck- of reachtruckcertificaat verdient zich in de logistiek vrijwel altijd terug. Vraag ons naar de mogelijkheden; in overleg met de opdrachtgever is er meer mogelijk dan je denkt.</p>',
 '2026-08-11T10:00:00Z', now()),

-- 4. flexibele-schil-opbouwen
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Een flexibele schil opbouwen","categorie":"Voor opdrachtgevers","teaser":"Hoe groot moet uw flexibele schil zijn, en hoe houdt u dezelfde gezichten op de vloer?","lead":"Een flexibele schil is geen noodgreep maar een ontwerp: het aandeel van uw bezetting dat meebeweegt met de orderportefeuille.","meta_description":"Hoe bouwt u een flexibele schil op die betrouwbaar en stabiel is?","leestijd":"4 min","author":"Dennis Klaver","authorRole":"Accountmanager","slug":"flexibele-schil-opbouwen","image_url":"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=900&q=70"}'::jsonb,
 'Een flexibele schil opbouwen die u niet in de steek laat',
 '<h2>Bepaal uw basislast</h2><p>Kijk naar de laagste maand van het afgelopen jaar. Dat volume vult u met vaste medewerkers. Alles daarboven is de zone waarin uitzendkrachten het verschil maken.</p><h2>Werk met een vaste pool</h2><p>Wij zetten bij voorkeur dezelfde mensen bij dezelfde opdrachtgever in. Zij kennen de lijn, de kwaliteitseisen en de collega''s, dat scheelt inwerktijd en fouten.</p><h2>Evalueer per kwartaal</h2><p>Een korte evaluatie met uw planner en onze intercedent houdt de match scherp. Wij sturen bij op competenties, niet alleen op aantallen.</p>',
 '2026-08-04T10:00:00Z', now()),

-- 5. schoonmaak-in-de-voedingsindustrie
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Schoonmaak in de voedingsindustrie","categorie":"Uitzendwerk","teaser":"In een snijhal is schoonmaak geen bijzaak. Wat vraagt dat van het personeel dat u inzet?","lead":"Bij voedselverwerking bepaalt de schoonmaakploeg of de productie de volgende ochtend op tijd kan starten.","meta_description":"Schoonmaak in de voedingsindustrie: wat vraagt het van uw personeel?","leestijd":"4 min","author":"Sanne de Vries","authorRole":"Intercedent","slug":"schoonmaak-in-de-voedingsindustrie","image_url":"https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=700&q=70"}'::jsonb,
 'Schoonmaak in de voedingsindustrie: hygiëne als productiefactor',
 '<h2>Werken volgens protocol</h2><p>HACCP-bewustzijn, kleurcodering van materialen en het correct doorlopen van de reinigingsstappen zijn geen extra''s maar basisvoorwaarden. Wij instrueren onze medewerkers hierop voordat zij de vloer op gaan.</p><h2>Nachtdienst vraagt andere mensen</h2><p>Reiniging gebeurt meestal tussen twee productieblokken in. Wij selecteren gericht op kandidaten die structureel in nachtdienst kunnen werken, zodat u geen wisselende bezetting krijgt.</p>',
 '2026-07-24T10:00:00Z', now()),

-- 6. nieuwe-opdrachtgever-rotterdam
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Nieuwe opdrachtgever in de Rotterdamse haven","categorie":"Bedrijfsnieuws","teaser":"Vanaf september leveren wij logistiek personeel voor een distributiecentrum aan de Maasvlakte.","lead":"Onze samenwerking met een distributeur van versproducten start in september met een team van vijftien medewerkers.","meta_description":"Light levert logistiek personeel voor distributiecentrum aan de Maasvlakte.","leestijd":"2 min","author":"Peter Licht","authorRole":"Directie","slug":"nieuwe-opdrachtgever-rotterdam","image_url":"https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=700&q=70"}'::jsonb,
 'Light breidt uit met een nieuwe opdrachtgever in de Rotterdamse haven',
 '<h2>Wat de samenwerking inhoudt</h2><p>Wij verzorgen de werving, planning en volledige administratie voor orderpicken en expeditie. De bezetting groeit mee met het seizoen.</p><h2>Wij zoeken collega''s</h2><p>Voor deze locatie zoeken wij orderpickers en chauffeurs. De actuele openstaande functies staan op onze vacaturepagina.</p>',
 '2026-07-15T10:00:00Z', now()),

-- 7. ploegendienst-volhouden
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Ploegendienst volhouden","categorie":"Voor werkzoekenden","teaser":"Wisselende diensten vragen wat van je lichaam. Praktische adviezen van medewerkers die het jaren doen.","lead":"Ploegendienst betaalt beter, maar alleen als je het vol kunt houden. Deze punten horen wij terug van medewerkers die al jaren in wisseldienst werken.","meta_description":"Praktische adviezen voor het volhouden van ploegendienst in de logistiek.","leestijd":"3 min","author":"Ilona Bakker","authorRole":"Recruitment","slug":"ploegendienst-volhouden","image_url":"https://images.unsplash.com/photo-1565891741441-64926e441838?w=700&q=70"}'::jsonb,
 'Ploegendienst volhouden: ritme, slaap en planning',
 '<h2>Houd één slaapblok aan</h2><p>Verschuif je slaap zoveel mogelijk in één blok in plaats van in losse stukken. Een vast ritueel voor het slapengaan helpt, ook overdag.</p><h2>Plan je maaltijden</h2><p>Eet je hoofdmaaltijd vóór de nachtdienst, niet halverwege. Dat voorkomt de dip rond vier uur ''s nachts.</p><h2>Bespreek je grenzen</h2><p>Kun je een bepaalde dienst structureel niet draaien, geef dat dan bij ons aan. Wij plannen liever realistisch dan dat je halverwege afhaakt.</p>',
 '2026-07-02T10:00:00Z', now()),

-- 8. wet-toelating-terbeschikkingstelling
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Toelatingsplicht voor uitleners","categorie":"Wet- en regelgeving","teaser":"De aangekondigde toelatingsplicht raakt iedereen die personeel ter beschikking stelt of inleent.","lead":"De wetgever wil malafide uitleners uit de markt halen met een toelatingsplicht. Voor inleners betekent dat een extra controleverplichting.","meta_description":"Toelatingsplicht voor uitleners: wat verandert er voor u als inlener?","leestijd":"5 min","author":"Mark Hoogeveen","authorRole":"Administratie","slug":"wet-toelating-terbeschikkingstelling","image_url":"https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=700&q=70"}'::jsonb,
 'Toelatingsplicht voor uitleners: wat verandert er voor u?',
 '<h2>Alleen inlenen bij toegelaten uitleners</h2><p>Inleners mogen straks uitsluitend personeel inlenen bij uitleners die zijn toegelaten en in het openbare register staan. Doet u dat niet, dan riskeert u een boete.</p><h2>Wat wij nu al doen</h2><p>Wij voldoen aan de SNA-normen en houden onze administratie daarop ingericht. Zodra het register live gaat, delen wij ons registratienummer actief met onze opdrachtgevers.</p>',
 '2026-06-20T10:00:00Z', now()),

-- 9. kosten-van-uitzenden
(gen_random_uuid(), 'blog', 'published',
 '{"onderwerp":"Wat kost een uitzendkracht werkelijk?","categorie":"Voor opdrachtgevers","teaser":"Het uurtarief is één getal. Dit is wat eronder zit, en wat u ermee bespaart.","lead":"Het tarief van een uitzendkracht ligt hoger dan een bruto uurloon. Zodra u alle werkgeverslasten meerekent, verandert het beeld.","meta_description":"Wat kost een uitzendkracht? Uitleg van het tarief en de besparingen.","leestijd":"4 min","author":"Dennis Klaver","authorRole":"Accountmanager","slug":"kosten-van-uitzenden","image_url":"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=900&q=70"}'::jsonb,
 'Wat kost een uitzendkracht werkelijk?',
 '<h2>Wat er in het tarief zit</h2><p>Loon volgens cao, vakantiegeld en -dagen, pensioenopbouw, sociale premies, verzuimrisico, werving en administratie. Al deze posten blijven bij ons liggen, ook als het werk stilvalt.</p><h2>Waar u op bespaart</h2><p>Geen doorbetaling bij minder werkaanbod, geen wervingskosten per vacature en geen verzuimadministratie. Bij wisselende volumes is dat doorgaans het punt waarop uitzenden goedkoper uitpakt dan vast personeel.</p>',
 '2026-06-06T10:00:00Z', now());

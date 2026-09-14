# THE LAST HEARTH: RINGS OF THE NORTH

Igriva verzija 0.1 za jednog igrača. TypeScript, Phaser 3.90.0 i Vite; sve slike i zvukovi su lokalni. Tekst u igri je na engleskom. Ovo je neslužbena, nekanonska fan-priča smještena u Međuzemlje, s izvornim putnikom, dolinom, manjim prstenovima i Ashen Regentom.

**Isporuka sadrži svih 30 kampanjskih etapa, a ne samo prvi odsječak.** Ovo je kandidat za prvo izdanje: automatizovana provjera sadržaja i sistema je završena, ali cjelovito ljudsko testiranje kampanje, ciljano trajanje 4–6 sati i rad na fizičkim telefonima nisu potvrđeni. Detaljne granice i stvarni rezultati su u `VERIFICATION.md`.

## Pokretanje bez instalacije

Otvorite `release/The-Last-Hearth.html` u savremenom desktop pregledniku. Ovaj fajl sadrži igru i sva 24 runtime resursa. Nisu potrebni račun, API ključ, veza s AI servisom ili plaćena usluga. Ako preglednik ograničava snimanje za lokalne HTML fajlove, igra nastavlja u memoriji i nudi izvoz. Za redovno igranje, naročito na telefonu, poslužite `dist/` putem HTTP/HTTPS-a.

## Izvorni projekat

Testirano u okruženju Node **24.19.0**, npm **11.9.0**. Zavisnosti su tačno zaključane u `package-lock.json`.

```bash
npm ci
npm run dev
```

Otvorite `http://localhost:4173`. Zatim:

```bash
npm test
npm run balance
npm run qa
npm run build
npm run preview
```

`npm run build` pravi statički produkcijski direktorij `dist/`. `npm run preview` lokalno poslužuje taj build na portu 4173. Nemojte istovremeno pokretati razvojni i produkcijski server na istom portu.

Za ponovnu izradu HTML izdanja:

```bash
npm run standalone
```

Igra ne preuzima runtime resurse s tuđih domena. Instalacija razvojnih zavisnosti zahtijeva pristup npm registru. `netlify.toml` i `vercel.json` pripremljeni su za build komandu `npm run build` i izlaz `dist`. Nije izvršen javni deployment.

## Šta je igrivo

- Tačno 30 etapa u šest poglavlja: zadatak, istraživanje, opcionalni kovčezi, checkpoint, boss, izlaz i trajno stanje završetka. Svaki boss ima vlastitu kombinaciju napada i uvod. Veliki bossovi su na etapama 5, 10, 15, 20, 25 i 30.
- Fizičko kretanje i borba u izometrijskom svijetu; patrola, opažanje, prilazak, najava napada, napad, oporavak, posrtanje i smrt neprijatelja. Sve tražene porodice stvorenja imaju prepoznatljive izvorne ilustracije. Nazgûl ima jahaću i spektralnu fazu te se protjeruje.
- Mač i štit, luk i dvoručna sjekira. Osnovni napadi ne troše izdržljivost. Čuvanje/pariranje, punjeni napadi, izbjegavanje, ograničena bočica, dva aktivna prstena.
- Nivoi 1–30, 29 talent-poena, tri staze s po deset različitih čvorova i tri spremljena kompleta. Besplatna promjena rasporeda kod kuće.
- Svih 12 prstenova, rangovi 1–10, evolucije 4/7, manji potporni učinci, kućni učinci, šest kombinacija s ograničenjima i zasebnim vremenima oporavka. Jedan prsten može biti samo na jednom mjestu.
- Naselje u kojem se može hodati. Postavljanje, rotacija, premještanje, rastavljanje, povrat tačno uloženih materijala i poništenje posljednjeg postavljanja. Jedan dom postaje koliba, kamena kuća, utvrđeno dvorište i mali dvorac. Centralni put i pristup vratima ostaju prohodni.
- Funkcionalni krevet, spremnik, kovačnica, radni sto za prstenove, vrt, kula, zidovi, kapija i trofeji; stanovnici sa svojim uslugama. Kućni prstenovi mijenjaju svjetlost i učinke naselja. Šest vraćenih svjetionika ostaju vidljivi.
- Četiri godišnja doba po četiri igraća dana. Uspjeh i odmor pomjeraju kalendar; poraz ne. Ekspedicija zadržava godišnje doba s polaska. Opcionalni kanali mijenjaju prohodnost, Frostwake ih zamrzava, Ember pali označene bramble, a Dawnward razbija opcionalne mračne pečate.
- Pet resursa, deterministička nadogradnja, trgovina, poređenje i zaključavanje opreme, sortiranje, rastavljanje i rezervni prostor za višak plijena.
- Dva završetka, teži povratci u postojeće etape, izazovi bossova, niz šest velikih bossova s checkpointima, lokalni lični rekordi, boje ogrtača i dobrovoljna odbrana naselja u tri talasa.

Pogledajte `docs/CAMPAIGN.md` za pregled svih etapa i `docs/RINGS.md` za tačne opise kolekcije.

## Kontrole

| Radnja | Desktop |
|---|---|
| Kretanje | WASD ili strelice |
| Nišanjenje | Pokazivač; opcija nišanjenja smjerom kretanja |
| Napad / kombinacija | Primarni klik ili J |
| Akcija oružja | Sekundarni klik ili K; mač čuva/parira, luk i sjekira pune pa oslobađaju napad |
| Izbjegavanje | Space |
| Aktivni prstenovi | Q / E |
| Liječenje | R |
| Interakcija | F |
| Oprema | I |
| Karta kampanje | M |
| Pauza / zatvaranje menija | Escape |

Tipke se mogu promijeniti u Settings. Na dodirnom ekranu lijeva palica pokreće putnika, a desna dugmad napadaju, koriste sekundarnu akciju, izbjegavanje, prstenove i bočicu. Dva pokazivača rade istovremeno. Settings nudi pomoć pri nišanjenju i lijevoruki raspored. Dugmad za dodir imaju najmanje 48 CSS piksela. Igra staje kada se otvore veliki meniji ili izgubi vidljivost; unos se čisti pri gubitku fokusa i otkazivanju dodira.

## Prvi koraci

Pomozite preživjelom na cesti tipkom F. Slijedite cestu do Emberovog kovčega. Jasna oznaka najave pokazuje gdje će udariti teški napad. Završite zadatak i priđite svjetioniku ispred bossa; on obnavlja zdravlje i bočice. Nakon pobjede vratite se kući i otvorite Build. Campfire košta 10 zlata i 2 drva; Simple shelter 30 zlata i 8 drva. Odaberite nacrt, kliknite slobodno tlo, rotirajte po želji i potvrdite.

## Snimanje i izvoz

IndexedDB baza `last-hearth-v01`, format snimka verzije 2. Automatsko snimanje slijedi sigurne checkpointe, dodjelu nagrada, kupovine, unapređenja, opremanje i gradnju. Dodjela nagrade i njen identifikator pišu se zajedno u jednu transakciju. Ponovno učitavanje usred bossa vraća igrača na ulaz. Smrt ne briše ranije prikupljen plijen.

`current` čuva putovanje, `backup` posljednje prethodno ispravno stanje. New Game i Import traže potvrdu, a prethodno putovanje čuvaju i pod `archive`, dostupno kao Previous journey. New Game ne briše postojeće putovanje bez upozorenja. Izvoz JSON-a i slika otvara pregled s linkom Download. Uvoz provjerava verziju, nivoe, prstenove, isključivost i otključavanje mjesta, resurse, identifikatore, kućne povrate, geometriju gradnje, postavke i checkpoint; podržana je migracija prethodnog internog formata 1.

Podaci pripadaju pregledniku i njegovom originu. Brisanje podataka stranice ili privatni režim mogu ukloniti lokalno snimanje. Koristite Export save za prenos između uređaja ili adresa. Ako pisanje ne uspije, status to vidljivo objašnjava; igra ostaje u memoriji.

## Struktura i izmjene

| Direktorij | Namjena |
|---|---|
| `src/game` | Logika svijeta, borba, ulaz, zvuk i Phaser prikaz |
| `src/systems` | Nivoi, oprema, ekonomija, gradnja, godišnja doba i snimanje |
| `src/world` | Geometrija, generisanje mapa, kolizije i linija pogleda |
| `src/content` | Tipizirane etape, prstenovi, građevine, talenti, priča i engleski rječnici |
| `src/ui` | Interfejs i originalni SVG simboli prstenova |
| `src/dev` | Isključivo razvojne provjere, izbačene iz produkcijskog builda |
| `public/assets` | Pripremljeni atlas, materijali, naslovna slika i WAV zvukovi |
| `assets-source` | Izvorne ilustracije i zapisi porijekla |
| `tests`, `scripts`, `qa-output` | Ponovljive provjere, simulacija i stvarni izvještaji |

Kolizije ostaju u koordinatama svijeta. Izometrijska projekcija i njena inverzija koriste istu transformaciju. Phaserovo vrijeme pokreće korak simulacije 1/60 sekunde, najviše šest koraka po ažuriranju, uz ograničenje dugog zastoja na 100 ms. Mape nastaju pri ulasku u misiju; zajednički atlas i četiri materijala učitavaju se jednom uz traku napretka. Ne postoji šest zasebnih velikih paketa regionalnih resursa.

`src/content/strings.ts` sadrži rječnik i zamjenjivi sloj lore podataka. `messages.en.json` sadrži izdvojene prezentacijske poruke i HTML predloške; pri prevođenju sačuvajte HTML atribute i oznake `{0}`, `{1}`. Imena i priča etapa/prstenova također su u sadržajnim tabelama. Engleski je jedini isporučeni jezik. Interni ID-evi, nazivi stanja i ključevi u snimcima nisu tekst za prevođenje.

Kao početna referenca korišten je [službeni Phaser TypeScript/Vite predložak](https://github.com/phaserjs/template-vite-ts). Zaključano izdanje provjereno je prema [Phaser 3.90.0 izdanju](https://github.com/phaserjs/phaser/releases/tag/v3.90.0) i [službenoj dokumentaciji Game konfiguracije](https://docs.phaser.io/phaser/concepts/game). Nije korišten template telemetry skript.

## Razvojne provjere

Na razvojnom serveru otvorite `http://localhost:4173/?qa=1`, počnite ili nastavite putovanje i koristite vidljivu ploču DEVELOPMENT FIXTURES. Ona učitava prethodno pripremljene bosseve, faze, poraz, nagradu i mobilni iframe. Testni snimci koriste memoriju ili `last-hearth-qa`; ne zamjenjuju standardni snimak igrača. `?fixture=25` direktno priprema 25. bossa nakon ulaska u igru. Ovi ulazi nisu dostupni u `dist/` ni u samostalnom HTML-u.

Nemojte pobjedu dugmetom Boss victory tretirati kao dokaz kvaliteta borbe. Plan daljeg ljudskog testiranja i poznata ograničenja nalaze se u `VERIFICATION.md`.

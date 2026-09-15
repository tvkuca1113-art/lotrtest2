# Provjera updatea 0.2 — 15. septembar 2026.

## Izvršene provjere

- `npm test`: **34/34 PASS**. Devet novih testova pokriva trenutak pogotka, odgođenu strijelu, pripremu sjekire, prekid zamaha izbjegavanjem, pauzu, kontinuirani juriš, doskok, prozirnost krošnje, rijeke/mostove i tok priče.
- `npm run qa`: **120/120 kombinacija etapa i godišnjih doba**; svi obavezni ciljevi, checkpointi, arene i izlazi prohodni. Skripte sada same stvaraju izlazni direktorij i rade u svježem checkoutu.
- `npm run balance`: nema zabilježenih deficita u simulaciji garantovanog prihoda. Dvorac je kupljen na etapi 25, uz 12 prstenova ranga 9; na kraju nivo 30 i svih 12 prstenova ranga 10. Ovo je računovodstvena simulacija, ne dokaz zabavnog balansa.
- `npm run build`: TypeScript i Vite produkcijski build uspješni. Lokalni runtime sadrži 31 resurs; dodatna grafika je komprimirana u WebP atlase.
- `npm run standalone`: uspješno; samostalni HTML ima **10.57 MiB**, uključujući svih 31 resurs.
- Produkcijski `dist/` preko HTTP-a i samostalni HTML preko `file://`: oba otvaraju novi prolog, daju kontrolu nakon preskakanja, učitavaju canvas bez JavaScript ili HTTP grešaka i ne izlažu razvojne fixture.
- Playwright/Chromium: **16/16 provjera toka**. Nema uhvaćenih JavaScript grešaka ni HTTP grešaka nedostajućih resursa u tim provjerama.

## Šta je provjereno u pregledniku

Prolog i mirovanje svijeta tokom čitanja; dijalog spašene Alde; otkriće Embera; nagrada prvog bossa i gradnja vatre i zaklona; IndexedDB snimanje i ponovno učitavanje; render i kratki ulazi kretanja, napada i dodgea u borbama 1, 5, 15, 25 i 30; poze luka i sjekire; smrt i povratak na ulaz bossa; oba epiloga i nastavak igranja; mobilni prolog i HUD bez horizontalnog prelijevanja.

U emulaciji dva istovremena dodira proizvela su **95.62 svjetske jedinice pomjeranja i tri napada u 0.85 s**. Dodiri su poslani preko Chromium Input događaja za joystick i napad, a zatim otpušteni. Nije korišten fizički telefon.

Boss setup, dolazak do udaljenih objekata, prvi završni udarac i završeci koriste razvojne fixture. Uvod, kontrole, meniji, teksture, spremanje i ponovno učitavanje prolaze kroz stvarni browser. Kratko upravljanje reprezentativnim borbama i vizuelni pregled kadrova nisu cjelovito ljudsko igranje ni ocjena zabavnosti svih 30 bossova. Stanja i napadačke faze svih 30 bossova dodatno su pokrivene sistemskim testom.

## Performanse — stvarna mjerenja i uslovi

Node 24.19.0, Playwright 1.62.1, Chrome Headless Shell **151.0.7922.34**, Linux kontejner. Nema fizičkog GPU/telefonskog benchmarka. Početna mapa, bez aktivnih neprijatelja, visoki kvalitet, DPR 1, bez CPU throttlea; jedan otvoren testni tab. Šest sekundi zagrijavanja i pet očitanja Phaser `actualFps` u razmaku od jedne sekunde. Očitana CPU obrada scene uglavnom je ispod nekoliko milisekundi; ona ne uključuje sav posao renderera.

| Prikaz | Prosjek FPS | Raspon uzoraka |
|---|---:|---:|
| 1440×900 | 33.92 | 33.66–34.24 |
| 390×844 | 59.42 | 58.72–59.92 |

Oba završna testa automatski su koristila **Phaser Canvas**. Prvi prolaz sa softverskim SwiftShader WebGL-om imao je samo oko 9–10 FPS u ovim uslovima. Zbog toga je uvedena provjera dostupnog renderera i Canvas fallback; dodatno je aktiviran requestAnimationFrame. Mjerenje nije obećanje stalnih 60 FPS na desktopu ili svim telefonima, niti dokazuje 30 FPS minimum tokom cijele kampanje. Kontinuirani borbeni benchmark na stvarnom GPU-u i fizičkom telefonu ostaje otvoren.

Sirovi browser i performance rezultati su u `docs/update-v02/`. `browser-results.json` potiče iz prolaza prije posljednjeg prelaska na requestAnimationFrame; `final-performance.json` je završno mjerenje. `performance-comparison.json` dokumentuje dijagnostički Canvas/WebGL eksperiment.

## Ponovljiva provjera preglednika

Osnovni build nema Playwright zavisnost. Za dodatnu razvojnu provjeru, nakon `npm ci`:

```bash
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node scripts/verify-update.cjs
```

Za postojeći kompatibilni Chromium postavite `HEARTH_BROWSER_PATH` na njegovu izvršnu datoteku. Skripta sama pokreće Vite na `127.0.0.1:4175`, koristi izolirani novi browser profil i zapisuje rezultate u `qa-update/`. Testiranje razvojnih fixture ne mijenja save u korisnikovom redovnom pregledniku. Testni dokazi pobjede ne mjere uživanje u borbi.

## Otvorene granice

Nije odigrana cijela kampanja od 4–6 sati. Nisu testirani fizički telefon, Safari/iOS, čitač ekrana, dugotrajni GPU stres ni zvuk na zvučnicima telefona. Kretanje mnogih neprijatelja i dalje animira ilustrirane poze transformacijom; ovo nije 3D skeletna animacija. Priroda ostaje vezana za postojeće kompaktne mrežne mape. Stari izvještaj `VERIFICATION.md` je historija verzije 0.1, ne rezultat ovog updatea.

# Stvarna provjera — The Last Hearth 0.1

Provjera završena 14. septembra 2026. Ovo je igriv kandidat za verziju 0.1 sa svih 30 etapa. Nije potvrđeno da su ispunjeni svi kvalitativni i vremenski ciljevi velikog produkcijskog izdanja.

## Automatizovana provjera

| Provjera | Rezultat i obuhvat |
|---|---|
| `npm test` | **25/25 prolazi**, bez preskočenih testova. Zapis: `qa-output/tests.log`. |
| Tipovi i produkcijski build | `tsc --noEmit` i Vite build prolaze. Zapis: `qa-output/build.log`. |
| Sadržaj | Tačno 30 različito imenovanih bossova, šest velikih bossova i 12 identiteta prstenova. |
| Prohodnost | Svih **120 kombinacija** 30 etapa × 4 godišnja doba ima put od početka do obaveznih ciljeva, checkpointa, arene i izlaza. BFS provjera u `qa-output/content-validation.json`. |
| Bossovi | Razvojne fixture provjere inicijaliziraju sve arene, njihove faze i uzorke napada, daju nagradu jednom i otvaraju završetak/izlaz. Nisu simulacija ljudskog uživanja u borbi. |
| Ekonomija | Simulacija garantovanih ciljeva i boss nagrada ne pokazuje deficit za dom na njegovim pragovima. Svi stečeni prstenovi dostižu trenutni limit; tri početna komada opreme unapređuju se svake treće etape. Nema prihoda od cacheva, običnih neprijatelja, trgovine ili ponavljanja. |
| Snimci | Migracija verzije 1, ispravni snimci i odbijanje pogrešnih ID-eva, nivoa, resursa, duplih mjesta, nepravilnih građevina, lažnih povrata, checkpointa i nedostajućih kontrola. |
| Transakcije | Negativni troškovi, ponovna kupovina, ponovna nagrada, dvostruki povrat, duplirana kuća i rastavljanje dvorca. |
| Borba i prstenovi | Vremenski oporavak, čuvanje, izbjegavanje, osnovni napad na 0 izdržljivosti, svi aktivni prstenovi, manje potporne vrijednosti, limit meta kroz cijelo bacanje, isključivost mjesta i zabrana rekurzije kombinacija. |
| Oprema i talenti | Višak opreme ostaje u rezervi; opremljeno i zaključano preživljava masovno rastavljanje; 30 različitih čvorova poštuje redoslijed i budžet 29 poena. |
| Sezone i kraj | Četverodnevni ciklus, umjereni modifikatori, stvarno zamrzavanje opcionalnog kanala, razbijanje mračnog pečata, lukom razbijiva sidra i obavezni završni conduit. |
| Samostalni HTML | Uspješan IIFE build; oko **7,66 MiB**, 24 ugrađena resursa, bez vanjskih script/style datoteka. Razvojni fixture kod nije u produkcijskim JS fajlovima. |

Testovi koriste stvarne sistemske funkcije i razvojne scenarije. Test prohodnosti provjerava mrežu i obavezne tačke; ne dokazuje da se svaki neprijatelj u svakoj mogućoj situaciji savršeno kreće oko svih uglova.

## Stvarno isprobano u pregledniku

Okruženje: udaljeni Chrome 151, viewport 1363×936, Phaser Canvas fallback. Hardver udaljenog preglednika nije poznat. Ovo nije test fizičkog desktop računara ili telefona.

| Scenarij | Šta je zaista urađeno |
|---|---|
| Svjež početak | Viđeni početnih 100 HP, 100 izdržljivosti, nivo 1, bez prstenova i kuće. Interakcija sa preživjelim potvrđena u interfejsu. |
| Ember → boss → prvi dom | Ember i ulaz pred bossa provjereni uz razvojno premještanje; napad, izbjegavanje i ring input isprobani. Pobjeda je zatim forsirana fixture dugmetom da se provjeri kućni tok. Shelter i campfire stvarno postavljeni kroz interfejs, snimljeni i ponovo učitani. **Ovo nije neprekinuti ručni prelazak prve etape.** |
| Reprezentativne borbe | Etape **1, 5, 15, 25 i 30** otvorene i djelimično igrane kroz preglednik. Isprobani napad, prsten/izbjegavanje, stubovi, chain telegraph, promjene faza i poraz. Faze su djelimično postavljene fixture kontrolama. Nije izvedena puna ljudska pobjeda na svih pet bossova. |
| Smrt i povratak | Poraz i Retry vraćaju uvod na checkpointu s punim zdravljem/bočicama. Jednokratne nagrade i ponovno učitavanje dodatno provjereni sistemskim testom. |
| Kućna ležišta | Ember ugrađen u socket 1, Frostwake u socket 2; Ember uklonjen iz active 1. Interfejs jasno pokazuje obje ugrađene lokacije. |
| Gradnja i dvorac | Kroz UI kupljena četiri unapređenja do dvorca. Rotacija isprobana; dvorac premješten sa 5,12 na **14,17**. Interfejs prikazuje tačan povrat od 8430 zlata, 568 drva, 775 kamena i 235 željeza za samu unaprijeđenu kuću. |
| IndexedDB | Stvarni roundtrip test na odvojenoj QA bazi: **PASS**, nivo 30, 12 prstenova, jedna građevina, backup prisutan. Raniji standardni snimak nivoa 2 sa skloništem i vatrom također je preživio reload. |
| Mobilni raspored | Stvarni CSS viewport u iframeu **390×844**. HUD, meniji, palica i akcijska dugmad pregledani. Lijevoruki raspored uključen i vizuelno pregledan. |
| Istovremeni dodir | Dva sintetička PointerEvent unosa, jedan za palicu i drugi za napad, držana 1,5 s: **154,1 world jedinica pomjeranja, 4 napada, oba unosa otpuštena**. Ovo potvrđuje handlere, ne fizički touchscreen ili pouzdanost iOS Safari dodira. |
| Oba završetka | Završna pobjeda forsirana u odvojenim fixture scenarijima. Odabrani i Across the valley i Around our hearth; završni dijalog i povratak kući rade, 30 etapa i 12 prstenova ostaju. |
| Postavke i oprema | Naslovne postavke, poređenje opreme, pauziranje velikim menijem i ponovni ulazak u svijet pregledani. |
| Izvoz slike | Nastala PNG slika naselja prikazana u izvoznoj ploči, `complete=true`, **1363×936**. Klik na Download izvršen, ali browser alat nije potvrdio događaj preuzimanja; stvarno spremanje preuzete slike nije potvrđeno. |
| Samostalno izdanje | Zapakovani HTML otvoren preko internog HTTP pregleda. Učitani naslov, postojeći snimak, igrivo naselje i inventar; slike su vidljive. **Direktno otvaranje putem `file://` nije testirano.** |
| Produkcijski direktorij | `dist/index.html` otvoren kroz HTTP pregled; naslov i nastavak putovanja učitani. |
| Konzola | U završnom HTML/produkcijskom smoke pregledu nisu pronađene greške aplikacije ili nedostajući resursi. Greške browserove ekstenzije za metapodatke odvojene su od aplikacije. Tokom razvoja ispravljena je prolazna Vite greška pri uvođenju novog rječnika. |

Screenshotovi u `qa-output/title.jpg` i `qa-output/standalone-home.jpg` su stvarni snimci preglednika, ne mockupovi. Slika budućeg doma na naslovu je izvorna konceptualna ilustracija; izgrađeni dom u igri koristi zasebni prop iz atlasa.

## Mjerenje performansi

Phaserov `actualFps`, uzorak svake sekunde tokom pet sekundi, u kućnoj sceni na desktop viewportu 1363×936:

| Uzorak | FPS |
|---|---:|
| 1 | 46,4 |
| 2 | 48,1 |
| 3 | 41,8 |
| 4 | 41,8 |
| 5 | 45,1 |
| Prosjek | **44,6** |

Kartica je bila vidljiva i fokusirana. Posljednji instrumentirani CPU update iznosio je približno **0,10 ms**; to ne uključuje puni GPU/browser posao niti predstavlja ukupno vrijeme frejma. U mobilnom iframeu očitan je trenutni rezultat 55,3 FPS, ali to nije kontinuirano mjerenje niti fizički mobilni profil. Ranije mjerenje s requestAnimationFrame u udaljenom browseru bilo je oko 1 FPS; konfiguracija je prebačena na Phaserov `forceSetTimeOut` mehanizam i ponovo izmjerena. Simulacija i dalje koristi engine vrijeme i fiksni korak.

**Cilj od 60 FPS nije ostvaren u izmjerenom udaljenom uzorku.** Uzorak jeste bio iznad 30 FPS. Ne tvrdimo da su time potvrđeni tipičan desktop, mobilni minimum pod opterećenjem, boss arene na slabom telefonu, Safari ili Firefox.

## Garantovana ekonomija

| Nakon etape | Nivo | Dom kupljen na pragu | Preostalo zlato | Prstenovi / najniži rang |
|---|---:|---|---:|---:|
| 5 | 6 | Drvena koliba | 578 | 3 / 2 |
| 10 | 11 | Kamena kuća | 1129 | 6 / 4 |
| 20 | 21 | Utvrđeno dvorište | 3077 | 10 / 7 |
| 25 | 26 | Mali dvorac | 41 | 12 / 9 |
| 30 | 30 | Mali dvorac | 3592 | 12 / 10 |

Ovo je jedna eksplicitna potrošačka strategija, ne dokaz da svaki proizvoljan redoslijed kupovine dostiže dvorac na istoj etapi. Dodatni izvori prihoda daju prostor za ukrase i trgovinu. Deficiti se ne kriju pretpostavljenim farmanjem.

## Preostala ograničenja i prihvatni kriteriji

1. **Trajanje i zabavnost nisu validirani.** Nije odigrana cijela kampanja 4–6 sati niti potvrđeno trajanje 4–6/8–12 minuta po etapi. Kompaktne mape mogu proizvesti kraće ekspedicije. Potreban je stvarni vremenski playtest i dalja prilagodba sadržaja, ne samo povećanje HP-a.
2. Mape imaju kompletne igrive puteve i različite zadatke/borbene kombinacije, ali dijele modularnu topologiju prostorija i hodnika. Istraživanje, okolišne priče i sezonske grane su sažeti. Mostovi i sabotaže koriste jednostavne interakcije, a ne posebne miniigre ili fizičku simulaciju popravke.
3. Ilustracije likova i neprijatelja koriste animaciju poza, rotaciju, bob, flip, oružje i feedback; nisu zasebno nacrtani višefrejmski ciklusi za svaku porodicu. Neki funkcionalni objekti i stanovnici dijele osnovne ilustracije i razlikuju se veličinom, bojom i uslugom. Ovo nije AAA nivo animacije i okolišne raznolikosti.
4. Sve tri oružne porodice i boss counterplay su implementirani, ali kompletna matrica 30 bossova × 3 oružja × 3 težine nije prošla ručni balansni test. Test pobjede fixture dugmetom ne dokazuje da je borba poštena ili zanimljiva.
5. Audio je lokalno sintetiziran i može se potpuno utišati. Nije izvedena posebna slušna provjera muzike, miksanja i zvučnika na fizičkim uređajima.
6. Stvarni uvoz JSON fajla kroz browserov file chooser, namjerno izazvan quota/IndexedDB kvar, dugotrajni retry/reload stres i fizička preuzimanja PNG-a ostaju neprovjereni UI scenariji. Parser, migracija i transakcijska pravila imaju sistemske testove.
7. Šest kućnih trofeja, dvije kućne ring lokacije i boje ogrtača postoje. Kućni prstenovi se vizuelno vežu za dva fiksna prostora oko naselja; to nisu proizvoljni slotovi na svakom pojedinom objektu. Zajednički atlas učitava se na početku; regionalni svjetovi se grade pri polasku, bez zasebnih regionalnih download paketa.
8. Nije izvršen javni deployment. ZIP sadrži stvarni produkcijski build i pripremljene konfiguracije za obični HTTPS hosting.

Za odluku o javnom izdanju preporučen je jedan neprekinuti main-path prelazak bez fixture pomoći, zasebno isprobavanje bossova 1/5/15/25/30 s osnovnim kompletom, te fizički Android/iOS test istovremenog dodira, audio pokretanja, izvoza i snimanja. To je plan preostalog ljudskog QA rada, a ne tvrdnja da je taj rad već obavljen.

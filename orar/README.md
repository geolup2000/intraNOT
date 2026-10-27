# intraNOT – Orar

Aplicație statică în limba română, inspirată de capturile furnizate. Deservește directorul `dist` prin HTTP.

Include navigarea între săptămâni și zile, revenirea la data curentă din București, setări pentru grupă, semigrupă și ultima zi vizibilă, încărcare PDF prin selecție sau drag-and-drop, stocare în IndexedDB și vizualizare/descărcare PDF. Preferințele se păstrează în localStorage.

PDF-urile nu sunt incluse în repository. La prima pornire, încarcă orarul din meniu. Un fișier implicit poate fi păstrat opțional local în `dist/orar-master.pdf`, ignorat de Git. Importul folosește PDF.js inclus local, fără CDN, API extern sau server de procesare. Datele și pozițiile textului din PDF identifică săptămânile, coloanele zilelor și exclusiv rândurile anului II. Orarul este recalculat din PDF la deschidere și după fiecare încărcare. Un PDF fără structura așteptată sau cu date invalide nu înlocuiește documentul curent.

Reguli confirmate: intervalul orar de la început, `c`/`C` = curs, `s`/`S` = seminar, `gr 1`–`gr 4` (inclusiv liste) = grupe. Numerele fără marcaj `gr` nu sunt interpretate drept grupe. Activitățile fără grupă explicită rămân vizibile pentru orice grupă; sunt etichetate „Fără grupă indicată”. Sunt incluse toate activitățile anului II, fără un filtru de specializare neconfirmat. Semigrupa este salvată ca preferință, dar nu filtrează activitățile până la definirea regulilor sale.

Dicționarul permanent `dist/discipline-legend.mjs` conține cele 286 de coduri distincte din cele 289 de rânduri ale legendei furnizate. Potrivirea este exactă, fără diferențiere între majuscule și minuscule; nu se deduc sinonime sau echivalențe între coduri. Codurile cu denumiri diferite în legendă păstrează ambele variante și generează o observație. Abrevierile care nu apar în legendă rămân ca în document. Textul original al fiecărei activități este disponibil în „Text din PDF”. PDF-ul legendei poate fi consultat din meniu doar dacă există local în `dist/legenda-discipline.pdf`; nu este încărcat pe GitHub.

Datele nu sunt corectate automat: S14 are anul 2021 după săptămâni din 2027 în PDF-ul furnizat; săptămâna este omisă și semnalată în raportul de import. Sunt acceptate variațiile de separatori din document, inclusiv intervalele dintre două luni și `09 -15-11.2026`.

Pornește local cu `node server.cjs` sau `start-local.cmd` și accesează `http://127.0.0.1:4173`. Aplicația se dezvoltă exclusiv local.

Verificări, din rădăcina repository-ului: `npm run check` și `npm test`. Pentru Debian și acces LAN, vezi README-ul principal.

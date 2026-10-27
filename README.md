# intraNOT

Aplicație web în limba română care transformă un orar universitar din PDF într-un calendar zilnic, cu interfață închisă și accent portocaliu.

## Pornire locală

Ai nevoie de Node.js 22 sau mai nou. Nu sunt necesare pachete npm suplimentare sau chei API.

```sh
npm start
```

Deschide **http://127.0.0.1:4173/**. Pe Windows poți porni aplicația și prin dublu clic pe `start-local.cmd`.

## Debian și acces din LAN

După clonarea repository-ului, intră în directorul proiectului și rulează:

```sh
bash install.sh
./start.sh
```

Scriptul folosește Node.js 22 sau mai nou dacă este deja disponibil. Altfel descarcă Node.js 24 din [distribuția oficială Node.js](https://nodejs.org/en/download), verifică SHA-256 și îl păstrează doar în `.local/node/`. Nu înlocuiește instalarea Node.js a sistemului. Dacă lipsesc utilitarele de descărcare, instalează `curl`, `ca-certificates`, `tar`, `xz-utils` și `coreutils` prin `apt-get`, cu `sudo` când este necesar. Descărcarea automată acceptă Debian pe x86_64 și ARM64.

Serverul ascultă implicit pe **0.0.0.0:4173**. De pe alt dispozitiv din aceeași rețea, accesează **http://IP-UL-SERVERULUI:4173/**. Adresele disponibile sunt afișate la pornire; pe Debian le poți verifica și cu `hostname -I`.

Pentru alt port:

```sh
INTRANOT_PORT=5000 ./start.sh
```

Pentru a limita accesul din nou la același calculator:

```sh
INTRANOT_HOST=127.0.0.1 ./start.sh
```

Dacă serverul are firewall activ, permite portul ales pentru dispozitivele din LAN. Scriptul nu modifică firewall-ul, nu configurează routerul și nu instalează un serviciu de fundal. Aplicația rulează în terminal până la `Ctrl+C`.

Aplicația nu are autentificare și este destinată unei rețele de încredere. Dispozitivele din LAN pot deschide aplicația; fișierele salvate în browser rămân proprii acelui browser. PDF-urile opționale așezate direct în `orar/dist/` sunt accesibile dispozitivelor care pot accesa serverul.

În meniul cu trei puncte, alege **Încarcă fișier PDF**, apoi selectează orarul. Aplicația păstrează documentul în IndexedDB, iar preferințele în localStorage, în browserul folosit. PDF-urile sunt procesate local, fără servicii externe.

## Funcționalități

- Navigare între săptămâni și zile și revenire la ziua curentă.
- Import exclusiv al rândurilor pentru anul II din structura de tabel acceptată.
- Afișarea intervalelor orare, a cursurilor și seminarelor.
- Filtrare după marcajele explicite de grupă (`gr 1`–`gr 4`, inclusiv liste).
- Înlocuirea codurilor recunoscute cu denumiri din dicționarul permanent al disciplinelor.
- Consultarea textului original al fiecărei activități și a observațiilor de import.
- Încărcare prin selecție sau drag-and-drop, vizualizare și descărcare a PDF-ului local.

## PDF-uri și date locale

**Repository-ul nu conține PDF-uri.** Acestea sunt excluse prin `.gitignore`. Fișierele încărcate prin aplicație nu sunt trimise către GitHub sau către servere externe.

Dicționarul de denumiri extras din legendă este inclus în `orar/dist/discipline-legend.mjs`; PDF-ul sursă nu este inclus. Opțional, poți păstra local un orar implicit în `orar/dist/orar-master.pdf` și legenda originală în `orar/dist/legenda-discipline.pdf`. Ambele rămân ignorate de Git.

## Reguli și limite ale importului

Parserul citește pozițiile textului pentru a identifica săptămânile, coloanele zilelor și rândurile anului II. Este adaptat structurii de tabel folosite pentru acest proiect; nu este un importator universal și nu face OCR pentru scanări.

`c`/`C` înseamnă curs, `s`/`S` înseamnă seminar. Numerele fără marcajul `gr` nu sunt interpretate drept grupe. Activitățile fără grupă explicită rămân vizibile pentru toate grupele, cu eticheta „Fără grupă indicată”. Semigrupa se salvează ca preferință, dar nu filtrează încă activitățile.

Codurile din legendă se potrivesc exact, fără diferențiere între majuscule și minuscule. Abrevierile necunoscute rămân neschimbate. Dacă un cod are mai multe denumiri în legendă, sunt păstrate variantele. Datele inconsistente sunt semnalate, fără corectare automată.

## Verificări

```sh
npm run check
npm test
```

GitHub Actions rulează aceleași verificări și confirmă că PDF-urile și fișierele locale nu sunt urmărite de Git. Workflow-ul nu publică aplicația.

## Structură

```text
orar/
  dist/                 Interfață, parser și dicționar permanent
    vendor/             PDF.js inclus local
  server.cjs            Server HTTP pentru LAN, configurabil prin mediu
  tests/                Teste pentru parser și denumiri
```

Pentru licențele componentelor terțe, vezi [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

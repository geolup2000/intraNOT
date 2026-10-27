# intraNOT

Aplicație web în limba română care transformă un orar universitar din PDF într-un calendar zilnic, cu interfață închisă și accent portocaliu.

## Pornire locală

Ai nevoie de Node.js 22.13 sau mai nou. Dependențele backendului se instalează din fișierul lock; nu sunt necesare chei API.

```sh
npm ci
npm start
```

Deschide **http://127.0.0.1:4173/**. Pe Windows poți porni aplicația și prin dublu clic pe `start-local.cmd`.

## Debian și acces din LAN

După clonarea repository-ului, intră în directorul proiectului și rulează:

```sh
bash install.sh
./start.sh
```

Scriptul folosește Node.js 22.13 sau mai nou dacă este deja disponibil. Altfel descarcă Node.js 24 din [distribuția oficială Node.js](https://nodejs.org/en/download), verifică SHA-256 și îl păstrează doar în `.local/node/`. Apoi instalează dependențele backendului prin `npm ci --omit=dev`. Nu înlocuiește instalarea Node.js a sistemului. Dacă lipsesc utilitarele de descărcare, instalează `curl`, `ca-certificates`, `tar`, `xz-utils` și `coreutils` prin `apt-get`, cu `sudo` când este necesar. Descărcarea automată acceptă Debian pe x86_64 și ARM64.

Serverul ascultă implicit pe **0.0.0.0:4173**. De pe alt dispozitiv din aceeași rețea, accesează **http://IP-UL-SERVERULUI:4173/**. Adresele disponibile sunt afișate la pornire; pe Debian le poți verifica și cu `hostname -I`.

Pentru alt port:

```sh
INTRANOT_PORT=5000 ./start.sh
```

Pentru a limita accesul din nou la același calculator:

```sh
INTRANOT_HOST=127.0.0.1 ./start.sh
```

Dacă serverul are firewall activ, permite portul ales pentru dispozitivele din LAN. Scriptul nu modifică firewall-ul și nu configurează routerul. Cu `./start.sh`, aplicația rulează în terminal până la `Ctrl+C`.

Aplicația nu are autentificare și este destinată unei rețele de încredere. Dispozitivele din LAN pot consulta și înlocui orarul comun. PDF-urile opționale așezate direct în `orar/dist/` sunt accesibile dispozitivelor care pot accesa serverul.

## Pornire automată la boot pe Debian

Dacă ai pornit deja aplicația manual, oprește-o cu `Ctrl+C`, apoi instalează serviciul. Dintr-un cont obișnuit, folosește:

```sh
sudo bash install-service.sh
```

Dacă ești autentificat direct ca root, poți rula aplicația și serviciul ca root, fără un cont separat:

```sh
bash install.sh
bash install-service.sh
```

Scriptul alege utilizatorul care a apelat `sudo`, sau utilizatorul curent când este apelat direct. Poți selecta explicit un cont cu `--user NUME_UTILIZATOR`, inclusiv `--user root`.

Serviciul `intranot.service` rulează sub contul ales, este activat la boot și se repornește după erori. Nu muta directorul proiectului după instalare; dacă îl muți, rulează din nou scriptul din noua locație.

```sh
sudo systemctl status intranot
sudo journalctl -u intranot -n 50 --no-pager
sudo systemctl restart intranot
```

Pentru a dezactiva pornirea automată și a opri aplicația:

```sh
sudo systemctl disable --now intranot
```

Pentru alt port, rulează `sudo systemctl edit intranot` și adaugă:

```ini
[Service]
Environment=INTRANOT_PORT=5000
```

Apoi rulează `sudo systemctl daemon-reload` și `sudo systemctl restart intranot`.

În meniul cu trei puncte, alege **Încarcă fișier PDF**, apoi selectează orarul. PDF-ul este trimis către backend, unde este validat, interpretat și salvat împreună cu orarul extras în `.local/data/`. Browserul primește date JSON și nu interpretează PDF-ul. Toate dispozitivele încarcă același orar de pe server; grupa și semigrupa sunt preferințe locale ale fiecărui browser. Nu sunt folosite servicii externe de procesare sau stocare.

## Reverse proxy

Exemplul complet Nginx este în [deploy/nginx.conf.example](deploy/nginx.conf.example). Proxy-ul trebuie să permită corpuri de cerere de 20 MB și să păstreze antetul `Host` al cererii originale:

```nginx
client_max_body_size 20m;
location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

Folosește adresa Debian în `proxy_pass` dacă proxy-ul rulează pe alt calculator. Configurarea HTTPS rămâne la reverse proxy. Pentru un subdirector precum `/orar/`, folosește `location /orar/` și `proxy_pass http://127.0.0.1:4173/;`, cu slash la final, pentru a elimina prefixul înainte de trimiterea la backend. Adresele API și PDF sunt relative și păstrează prefixul în browser.

Dacă proxy-ul rescrie `Host`, poți indica explicit originea publică prin configurația serviciului (`systemctl edit intranot`):

```ini
[Service]
Environment=INTRANOT_PUBLIC_ORIGIN=https://orar.example.com
```

Alternativ, pentru un proxy de încredere care suprascrie corect `X-Forwarded-Host` și `X-Forwarded-Proto`, poți activa `Environment=INTRANOT_TRUST_PROXY=1`. Implicit, aceste antete nu sunt folosite pentru a autoriza încărcări. După modificări: `systemctl daemon-reload` și `systemctl restart intranot`.

Pentru actualizarea unei instalări existente:

```sh
git pull
bash install.sh
systemctl restart intranot
```

## Funcționalități

- Navigare între săptămâni și zile și revenire la ziua curentă.
- Import exclusiv al rândurilor pentru anul II din structura de tabel acceptată.
- Afișarea intervalelor orare, a cursurilor și seminarelor.
- Filtrare după marcajele explicite de grupă (`gr 1`–`gr 4`, inclusiv liste).
- Înlocuirea codurilor recunoscute cu denumiri din dicționarul permanent al disciplinelor.
- Consultarea textului original al fiecărei activități și a observațiilor de import.
- Încărcare prin selecție sau drag-and-drop, vizualizare și descărcare a PDF-ului local.

## PDF-uri și date locale

**Repository-ul nu conține PDF-uri.** Acestea sunt excluse prin `.gitignore`. Fișierele încărcate prin aplicație sunt salvate doar pe serverul tău și nu sunt trimise către GitHub sau către servicii externe.

Directorul `.local/data/` conține PDF-urile, metadatele și fișierele JSON cu orarul extras în backend. Salvarea noii versiuni este atomică, iar versiunile anterioare sunt păstrate. Documentele invalide sau cu structură nesuportată sunt respinse de backend și nu înlocuiesc orarul curent. Datele supraviețuiesc repornirii serviciului și actualizărilor prin `git pull`; nu șterge acest director. Pentru altă locație de stocare poți configura `INTRANOT_DATA_DIR`, cu drepturi de citire și scriere pentru contul serviciului.

PDF-urile deja salvate de versiunile anterioare sunt interpretate automat în backend la prima cerere pentru datele orarului; nu trebuie încărcate din nou.

La actualizarea de la versiunea care salva doar în browser, deschide aplicația pe PC-ul și la aceeași adresă unde ai încărcat PDF-ul inițial. Dacă serverul nu are încă un orar, copia veche din browser este migrată automat. Dacă browserul nu mai are fișierul, încarcă-l o singură dată din nou. Pe telefon, reîncarcă pagina folosind adresa aceluiași server. Un orar deja salvat pe server are prioritate față de copiile vechi din browser.

Pagina verifică schimbările la revenirea în aplicație și la fiecare 30 de secunde cât timp este vizibilă.

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
    vendor/             Textul licenței PDF.js
  server.cjs            Server HTTP pentru LAN, configurabil prin mediu
  backend-pdf.mjs       Extragerea PDF exclusiv în backend
  schedule-store.cjs    PDF-uri și date JSON persistente
  tests/                Teste pentru parser și denumiri
```

Pentru licențele componentelor terțe, vezi [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

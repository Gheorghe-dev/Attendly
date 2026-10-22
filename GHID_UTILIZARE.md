# 📘 Ghid de Utilizare — Attendly

**Attendly** este o platformă modernă, elegantă și gratuită de monitorizare a prezenței universitare, concepută pentru a fi rulată direct de pe laptopul cadrului didactic, fără costuri de găzduire sau abonamente cloud.

---

## 📑 Cuprins
1. [Pornirea și Oprirea Aplicației](#1-pornirea-și-oprirea-aplicației)
2. [Configurare Inițială și Autentificare](#2-configurare-inițială-și-autentificare)
3. [Crearea unui Curs și Importul Studenților](#3-crearea-unui-curs-și-importul-studenților)
4. [Lansarea unei Sesiuni de Prezență](#4-lansarea-unei-sesiuni-de-prezență)
5. [Cum se Înregistrează Studenții (Experiența pe Mobil)](#5-cum-se-înregistrează-studenții-experiența-pe-mobil)
6. [Monitorizarea Live și Încheierea Sesiunii](#6-monitorizarea-live-și-încheierea-sesiunii)
7. [Rapoarte și Export Excel](#7-rapoarte-și-export-excel)
8. [Situații Speciale și Recomandări Practice](#8-situații-speciale-și-recomandări-practice)

---

## 1. Pornirea și Oprirea Aplicației

Aplicația este optimizată pentru rulare locală rapidă pe Windows.

### Modul 1: Rulare Locală (Pentru pregătire cursuri, importuri, teste)
- Deschideți fișierul **`start.bat`** (dublu click) sau rulați în terminal:
  ```bash
  npm start
  ```
- Aplicația va fi disponibilă la: **[http://localhost:3000](http://localhost:3000)**.

### Modul 2: Rulare în Amfiteatru / Sală (Cu conexiune pentru studenți)
Pentru ca studenții să poată scana codul QR de pe telefoanele lor conectate la date mobile sau Wi-Fi-ul universității:
- Rulați comanda:
  ```bash
  node scripts/start-internet.js
  ```
- Acest script pornește serverul și deschide automat un **Cloudflare Quick Tunnel** securizat (`https://*.trycloudflare.com`).
- Link-ul public generat va fi integrat automat în codul QR proiectat în sală.

### Oprirea Aplicației
- Deschideți fișierul **`stop.bat`** pentru a opri instant serverul și procesele asociate.

---

## 2. Configurare Inițială și Autentificare

La prima pornire a aplicației:
1. Accesați **[http://localhost:3000](http://localhost:3000)** în browser (Chrome, Edge, Firefox, Safari).
2. Dacă este prima lansare, veți fi redirecționat automat către ecranul de configurare inițială (`/setup`):
   - Introduceți **Numele complet** (ex: *Conf. Dr. Alexandru Popescu*).
   - Introduceți **Adresa de email instituțională** și o **Parolă securizată**.
   - Salvați contul.
3. La accesările viitoare, vă autentificați direct la ecranul de login (`/login`) cu email-ul și parola setate.

> [!NOTE]
> Toate parolele sunt criptate prin algoritmul securizat **bcrypt**, iar sesiunea este păstrată activă prin token JWT.

---

## 3. Crearea unui Curs și Importul Studenților

### Pasul 1: Crearea Cursului
1. În ecranul principal (**Dashboard**), apăsați butonul **„Curs Nou”** (`+ Curs Nou`).
2. Completați datele cursului:
   - **Titlul disciplinei**: (ex: *Arhitectura Sistemelor de Calcul*)
   - **Codul cursului**: (ex: *ASC-2026*)
   - **Descriere / Semestru**: (opțional)
3. Apăsați **„Creează Cursul”**.

### Pasul 2: Importul Studenților din Excel (`.xlsx`)
Attendly include un modul inteligent și tolerant la erori pentru citirea cataloagelor:
1. Intrați în pagina cursului nou creat și navigați la tab-ul **Studenți**.
2. Puteți descărca șablonul recomandat apăsând pe **„Descarcă Șablon Excel”**.
3. Formatul suportat conține 3 coloane (anteturile pot fi în Română sau Engleză):
   - **Coloana 1 (Nume)**: `Nume`, `Student Name`, `Nume Student`
   - **Coloana 2 (Email)**: `Email`, `Mail`, `University Email`
   - **Coloana 3 (Grupă)**: `Grupa`, `Group`, `Subgroup` (ex: `AIA 3.1A`, `312 CC`, `ELA 2.2B`)
4. Trageți fișierul Excel în zona de upload sau apăsați pentru a-l selecta.
5. **Previzualizare și Validare**:
   - Sistemul va afișa o previzualizare: rânduri valide, avertizări pentru rânduri incorecte sau dubluri detectate.
   - Apăsați **„Confirmă și Salvează”** pentru a înregistra studenții în baza de date.

---

## 4. Lansarea unei Sesiuni de Prezență

Când începe cursul sau laboratorul:
1. Din pagina cursului, apăsați pe **„Sesiune Nouă”**.
2. **Selectați Grupele Vizate**:
   - Alegeți grupele care participă la laborator/seminar (ex: doar `AIA 3.1A`) sau bifați întreaga promoție pentru curs general.
   - *Studenții din alte grupe vor fi notificați automat dacă încearcă să se bifeze la o sesiune care nu le este adresată.*
3. Apăsați **„Lansează Sesiunea”**.

---

## 5. Cum se Înregistrează Studenții (Experiența pe Mobil)

După lansarea sesiunii, pe ecranul laptopului profesorului se deschide automat **Fereastra de Proiecție QR**:
1. Apăsați pe pictograma de **Full Screen (Ecran Complet)** sau proiectați fereastra pe videoproiector / monitorul sălii.
2. **Ce face studentul**:
   - Deschide camera foto a telefonului mobil și scanează codul QR proiectat.
   - Este direcționat pe pagina securizată de prezență.
   - Introduce adresa de email universitară (ex: `andrei.ionescu@student.upt.ro`).
   - Apasă pe **„Confirmă Prezența”**.
3. **Feedback Instant**:
   - **Succes (Verde)**: Studentul vede bifa verde, ora exactă a înregistrării și confirmarea validării în catalog.
   - **Dublură prevenită**: Dacă trimite din nou formularul, sistemul îi amintește că a fost deja marcat prezent la ora inițială.
   - **Tentativă de proxy blocată (Dispozitiv duplicat)**: Dacă același telefon/browser a fost deja folosit pentru a înregistra un alt student în această sesiune, cererea este **respinsă imediat**. Studentul este atenționat că fiecare persoană trebuie să scaneze de pe propriul telefon mobil.
   - **Respins (Roșu)**: Dacă email-ul nu figurează în catalogul cursului sau dacă este dintr-o altă grupă neschedulată.

---

## 6. Monitorizarea Live și Încheierea Sesiunii

În timp ce codul QR este proiectat:
- **Flux Live în Timp Real**: Datorită conexiunii de tip Server-Sent Events, tabelul de prezență se actualizează automat la fiecare scanare, fără a fi nevoie de reîncărcarea paginii (`F5`).
- **Protecție Anti-Proxy Activă**: În antetul sesiunii și în parametrii de securitate este afișată starea *„1 Dispozitiv / Student”*.
- **Jurnal Trimiteri Respinse**: Dacă cineva a încercat să scaneze pentru un coleg absent folosind același telefon, profesorul vede imediat în panou tentativa blocată (*„Dispozitiv duplicat”*).
- **Notificări Instant**: Notificarea de tip toast afișează studentul și grupa pe măsură ce se confirmă prezența.
- **Contoare Live**: Vedeți în permanență numărul de studenți prezenți din totalul celor înscriși și procentul de prezență.
- **Închiderea Sesiunii**: La finalul intervalului alocat prezenței, apăsați butonul **„Închide Sesiunea”**. Din acel moment, codul QR devine inactiv și nu se mai pot trimite prezențe.

---

## 7. Rapoarte și Export Excel

Toate datele pot fi descărcate rapid în format compatibil Microsoft Excel:

1. **Export Sesiune Individuală**:
   - Din ecranul sesiunii, apăsați **„Exportă Raport (.xlsx)”**.
   - Se generează un fișier Excel cu toți studenții din grupele vizate:
     - Studenții prezenți sunt evidențiați cu verde, alături de ora exactă a scanării.
     - Studenții absenți sunt evidențiați cu roșu.
2. **Export Centralizator Curs (Toate Sesiunile)**:
   - Din pagina principală a cursului, apăsați butonul **„Exportă Catalog (.xlsx)”**.
   - Se generează o matrice completă pe întreg semestrul: fiecare student pe un rând, cu coloane pentru fiecare sesiune desfășurată și totalul de prezențe acumulat.

---

## 8. Situații Speciale și Recomandări Practice

> [!NOTE]
> **Ce se întâmplă dacă un student introduce o adresă greșită de email?**
> Attendly salvează toate încercările nerecunoscute într-un jurnal special (*„Trimiteri nerecunoscute”*). Puteți vedea imediat dacă un student a greșit un caracter la tastarea adresei și îl puteți valida manual.

> [!IMPORTANT]
> **Unde sunt stocate datele?**
> Baza de date este complet locală în fișierul `prisma/dev.db`. Nu depindeți de servere externe, iar datele cu caracter personal ale studenților rămân exclusiv pe laptopul dumneavoastră. Pentru siguranță, puteți face periodic o copie de rezervă a fișierului `prisma/dev.db`.

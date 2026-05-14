---
trigger: always_on
---

# PROJEKT KONTEXTUS ÉS FELADATLEÍRÁS: Napi Jelenléti Anomáliák (Értesítő Modal)

## 1. A Projekt Áttekintése
A **Fémszer-Hulladék Kft.** számára készítünk egy digitális üzemi nyilvántartó Dashboardot. 
- **Technológiai stack:** HTML (Single Page Application), Tailwind CSS (CDN), Vanilla JavaScript, Firebase Firestore (adatbázis), Firebase Hosting.
- **Működés:** A gyárban a dolgozók tableten, NFC kártyával csekkolnak be/ki. Egy külső n8n automatizáció végzi az adatbázis (Firestore) írását és az adatok automatikus javítását (pl. ha valaki elfelejt csekkolni, az n8n éjszaka vagy délután pótolja az időpontot).

## 2. Jelenlegi Fájlstruktúra és Konfigurációk
A projektben az alábbi konfigurációs fájlok már fixek és tökéletesen működnek. **Ezeket NEM kell módosítanod, csak tudj róluk a kontextus miatt:**

- `firebase.json`: Biztosítja az SPA működést (minden forgalmat az `index.html`-re irányít).
- `.firebaserc`: A `femszer` projekt default beállítása.
- `style.css`: Egyedi kiegészítések a Tailwind mellé (egyedi scrollbar, táblázat hover effektek, pulzáló animáció a "Jelen van" státuszhoz, és egy nagyon komplex `@media print` blokk a PDF generáláshoz).

## 3. Adatbázis Séma (Firebase Firestore)
A frontend lekéri a dolgozók listáját és az aznapi jelenléti adatokat.

### 3.1. `dolgozok` kollekció (Törzsadatok)
Objektumokat tartalmazó tömb, a releváns mezők:
- `name` (String): Dolgozó neve.
- `status` (String): Ha az értéke `"Archivált"`, akkor ő egy kilépett dolgozó. **A logikában őket teljesen figyelmen kívül kell hagyni!**

### 3.2. `jelenlet_naplo` kollekció (Aznapi tranzakciók)
Objektumokat tartalmazó tömb, a releváns mezők:
- `name` (String): Dolgozó neve.
- `date` (String): Dátum (pl. "2026.05.11").
- `arrival` (String): Érkezés ideje (pl. "07:00").
- `departure` (String): Távozás ideje (pl. "16:00").
- `status` (String): `"Jelen van"` vagy `"Eltávozott"`.
- **N8N LOGIKAI FLAGEK:** Ezek a mezők CSAK akkor léteznek egy dokumentumban, ha a rendszer automatikusan javította az adatot a dolgozó helyett:
  - `auto_kicsekkolas` (Boolean): A gép írta be a 16:00-s távozást.
  - `auto_becsekkolas` (Boolean) vagy `auto_korrekcio` (Boolean): A gép írta be utólag a 07:00-s érkezést.

---

## 4. A Megoldandó Feladat
Amikor az Adminisztrátor belép a Dashboardra, és a rendszer betölti az aznapi adatokat, fel kell ugrania egy **Figyelmeztető Modalnak**, ha az alábbi két anomália bármelyike fennáll:
1. **Rendszer által pótolt idők:** A dolgozó elfelejtett csekkolni, és az n8n (a fenti boolean flagek valamelyikével) pótolta az időt.
2. **Nincs mai adat:** Aktív (nem archivált) dolgozó, akinek a neve egyáltalán nem szerepel az aznapi `jelenlet_naplo` tömbben.

### 4.1. Elvárt HTML Kód (Hova: `index.html` body vége)
Készíts egy Tailwind CSS alapú, modern Modalt (pl. `id="system-alert-modal"`).
- Alapból legyen rejtett (`hidden` osztály).
- Legyen benne két dinamikus lista (szekció): 
  - Egy szekció a pótolt időknek (ideális esetben megkülönböztetve, hogy reggeli vagy délutáni pótlás történt).
  - Egy szekció a hiányzóknak ("Nincs mai adat").
- Legyen egy "Tudomásul vettem" gomb, ami bezárja a modalt.
- Használj FontAwesome ikonokat a figyelemfelhívásra.
- *Megjegyzés a CSS miatt:* A `style.css`-ben lévő print szabályok miatt aggódni nem kell, a modal alapból rejtve lesz nyomtatáskor.

### 4.2. Elvárt JavaScript Kód (Hova: Fő JS fájl / `<script>` blokk)
Írj egy `checkDailyAnomalies(dolgozok, napiJelenletek)` nevű függvényt, ami:
1. Megkapja a két Firebase-ből lekért tömböt.
2. **Kikeresi a korrigáltakat:** Végigiterál a `napiJelenletek` tömbön, és ha valamelyik `auto_` flag `true`, legenerálja az 1. lista HTML elemeit.
3. **Kikeresi a hiányzókat:** Végigiterál a `dolgozok` tömbön. Ha `status !== "Archivált"` ÉS a dolgozó neve nincs benne a `napiJelenletek`-ben, legenerálja a 2. lista HTML elemeit.
4. **Megjelenítés vezérlése:** Csak azokat a szekciókat (DOM elemeket) tegye láthatóvá a Modalban, amelyekben van is hiba. Ha van legalább egy hiba, távolítsa el a `hidden` osztályt a fő Modalról.

Kérlek, generáld le a pontos HTML struktúrát és a Vanilla JS logikát, felkommentezve, hogy pontosan hova kell beilleszteni őket az `index.html`-ben!
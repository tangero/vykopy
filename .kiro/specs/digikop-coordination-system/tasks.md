# Implementační plán

- [x] 1. Nastavení projektové struktury a základních rozhraní
  - Vytvoření adresářové struktury pro modely, služby, repozitáře a API komponenty
  - Definování TypeScript rozhraní pro všechny datové modely
  - Nastavení základní Express.js aplikace s middleware
  - Konfigurace PostgreSQL databáze s PostGIS rozšířením
  - Vytvoření railway.json konfigurace pro deployment
  - _Požadavky: 1.1, 1.3, 1.4_

- [x] 2. Implementace autentizace a správy uživatelů
- [x] 2.1 Vytvoření uživatelského modelu a autentizace
  - Implementace User modelu s validací emailu a hesla
  - JWT autentizace s refresh token mechanismem
  - Bcrypt hashování hesel s salt rounds 12
  - _Požadavky: 1.1, 1.4_

- [x] 2.2 Implementace registrace a správy uživatelů
  - API endpoint pro registraci nových uživatelů
  - Schvalovací workflow pro nové registrace
  - CRUD operace pro správu uživatelských účtů
  - _Požadavky: 1.1, 1.2_

- [x] 2.3 Implementace RBAC systému s geografickými oprávněními
  - Middleware pro kontrolu rolí a územních oprávnění
  - Tabulka user_territories pro přiřazení obcí
  - SQL filtry pro omezení přístupu podle území
  - _Požadavky: 1.3, 1.5, 2.2_

- [x] 2.4 Napsání unit testů pro autentizaci
  - Testy pro registraci, přihlášení a JWT validaci
  - Testy pro RBAC middleware a územní omezení
  - _Požadavky: 1.1, 1.3_

- [x] 3. Vytvoření databázového schématu a modelů
- [x] 3.1 Implementace databázových tabulek
  - Vytvoření SQL migračních skriptů pro všechny tabulky
  - Nastavení PostGIS indexů pro prostorové dotazy
  - Implementace constraints a validačních pravidel
  - _Požadavky: 3.1, 3.2, 7.1_

- [x] 3.2 Implementace Project modelu s validací
  - TypeScript interface a Zod schéma pro projekty
  - Validace geometrických dat a časových rozsahů
  - Workflow state management s přechodovými pravidly
  - _Požadavky: 3.1, 3.3, 3.5_

- [x] 3.3 Implementace Moratorium modelu
  - Model pro evidenci moratorií s prostorovou geometrií
  - Validace časových období a maximální délky 5 let
  - _Požadavky: 4.1, 4.2, 4.5_

- [x] 3.4 Napsání unit testů pro datové modely
  - Testy validace projektových dat
  - Testy pro workflow state přechody
  - _Požadavky: 3.1, 3.3_

- [x] 4. Implementace detekce konfliktů
- [x] 4.1 Vytvoření prostorové detekce konfliktů
  - PostGIS dotazy pro detekci překryvů s 20m bufferem
  - Algoritmus pro kontrolu časových překryvů
  - Optimalizace prostorových dotazů s indexy
  - _Požadavky: 7.1, 7.2, 7.4_

- [x] 4.2 Implementace kontroly moratorií
  - Detekce narušení aktivních moratorií
  - Varování při registraci projektů v omezených oblastech
  - _Požadavky: 4.4, 7.4_

- [x] 4.3 Vytvoření conflict detection API
  - REST endpoint pro spuštění detekce konfliktů
  - Asynchronní zpracování s výsledky do 10 sekund
  - Uložení výsledků konfliktů do databáze
  - _Požadavky: 7.1, 7.3, 7.5_

- [x] 4.4 Napsání testů pro detekci konfliktů
  - Testy prostorových překryvů s různými geometriemi
  - Testy časových konfliktů a edge cases
  - _Požadavky: 7.1, 7.2_

- [x] 5. Implementace notifikačního systému
- [x] 5.1 Vytvoření email služby
  - Konfigurace SMTP s SendGrid nebo podobnou službou
  - HTML šablony pro různé typy notifikací
  - Queue systém pro asynchronní odesílání emailů
  - _Požadavky: 5.1, 5.2, 5.4_

- [-] 5.2 Implementace notifikačních triggerů
  - Automatické odesílání při změnách stavu projektů
  - Notifikace při detekci konfliktů
  - Upozornění na blížící se termíny
  - _Požadavky: 5.1, 5.3, 5.5_

- [ ]* 5.3 Napsání testů pro notifikace
  - Mock testy pro email odesílání
  - Testy správného načasování notifikací
  - _Požadavky: 5.1, 5.2_

- [ ] 6. Vytvoření REST API pro projekty
- [x] 6.1 Implementace CRUD operací pro projekty
  - GET /api/projects s filtrováním a stránkováním
  - POST /api/projects pro vytvoření nového projektu
  - PUT /api/projects/:id pro aktualizaci
  - DELETE /api/projects/:id s kontrolou oprávnění
  - _Požadavky: 3.1, 3.2, 2.2_

- [x] 6.2 Implementace workflow API
  - PUT /api/projects/:id/status pro změny stavů
  - Validace povolených přechodů mezi stavy
  - Automatické spuštění detekce konfliktů při odeslání ke schválení
  - _Požadavky: 3.4, 3.5, 2.4_

- [x] 6.3 Implementace komentářového systému
  - POST /api/projects/:id/comments pro přidání komentáře
  - GET /api/projects/:id/comments pro načtení historie
  - Validace délky komentářů (max 1000 znaků)
  - _Požadavky: 8.1, 8.2, 8.4_

- [ ] 6.4 Napsání integration testů pro API
  - E2E testy pro kompletní workflow projektů
  - Testy autorizace a územních omezení
  - _Požadavky: 3.1, 3.4, 2.2_

- [ ] 7. Implementace prostorových API
- [ ] 7.1 Vytvoření spatial operations API
  - POST /api/spatial/conflicts pro detekci konfliktů
  - GET /api/spatial/municipalities pro detekci dotčených obcí
  - Optimalizace PostGIS dotazů pro rychlé odpovědi
  - _Požadavky: 3.2, 7.1, 7.5_

- [ ] 7.2 Implementace moratorium API
  - CRUD operace pro správu moratorií
  - Prostorové dotazy pro aktivní moratoria
  - Validace překryvů s existujícími omezeními
  - _Požadavky: 4.1, 4.2, 4.3_

- [ ]* 7.3 Napsání testů pro prostorové operace
  - Testy PostGIS funkcí s reálnými geometriemi
  - Performance testy pro velké datasety
  - _Požadavky: 7.1, 4.1_

- [ ] 8. Vytvoření React frontend aplikace
- [ ] 8.1 Nastavení React projektu s TypeScript
  - Vytvoření React aplikace s Vite build toolem
  - Konfigurace TypeScript, ESLint a Prettier
  - Nastavení Redux Toolkit pro state management
  - Konfigurace React Router pro navigaci
  - _Požadavky: 6.1, 6.2_

- [ ] 8.2 Implementace autentizačních komponent
  - Přihlašovací formulář s validací
  - Registrační formulář pro nové uživatele
  - JWT token management a automatické obnovování
  - Protected routes s role-based přístupem
  - _Požadavky: 1.1, 1.4, 2.2_

- [ ] 8.3 Vytvoření základního layoutu aplikace
  - Hlavní navigační komponenta s user menu
  - Responzivní layout pro desktop a mobile
  - Sidebar komponenta pro detaily projektů
  - _Požadavky: 6.1, 6.2, 6.4_

- [ ]* 8.4 Napsání testů pro React komponenty
  - Unit testy s React Testing Library
  - Testy pro formuláře a validace
  - _Požadavky: 8.1, 8.2_

- [ ] 9. Implementace mapového rozhraní
- [ ] 9.1 Integrace Mapbox GL JS
  - Nastavení Mapbox účtu a API klíčů
  - Základní mapová komponenta s ovládacími prvky
  - Konfigurace mapových vrstev (OSM, ortofoto, katastr)
  - _Požadavky: 6.1, 6.3, 6.4_

- [ ] 9.2 Implementace vizualizace projektů na mapě
  - Renderování projektů jako geometrických objektů
  - Barevné kódování podle stavů projektů
  - Interaktivní tooltips a click handlery
  - _Požadavky: 6.1, 6.2, 6.5_

- [ ] 9.3 Vytvoření kreslicích nástrojů
  - Nástroje pro kreslení bodů, linií a polygonů
  - Editace existujících geometrií
  - Validace a simplifikace nakreslených tvarů
  - _Požadavky: 3.1, 3.2_

- [ ] 9.4 Implementace filtrování a vyhledávání na mapě
  - Filtry podle stavu, data a kategorie projektů
  - Vyhledávání podle adresy s geocoding API
  - Toggle pro zapínání/vypínání mapových vrstev
  - _Požadavky: 6.4, 6.5_

- [ ]* 9.5 Napsání testů pro mapové komponenty
  - Headless browser testy pro mapové interakce
  - Testy kreslicích nástrojů a geometrické validace
  - _Požadavky: 6.1, 3.1_

- [ ] 10. Implementace formulářů pro projekty
- [ ] 10.1 Vytvoření multi-step formuláře pro nové projekty
  - Krok 1: Základní informace (název, žadatel, zhotovitel)
  - Krok 2: Vyznačení lokality na mapě
  - Krok 3: Časový rámec a kategorizace
  - Validace každého kroku před pokračováním
  - _Požadavky: 3.1, 3.2, 3.3_

- [ ] 10.2 Implementace draft/submit funkcionalité
  - Ukládání rozpracovaných projektů jako koncepty
  - Automatické ukládání při změnách formuláře
  - Odeslání ke schválení s validací povinných polí
  - _Požadavky: 3.3, 3.5_

- [ ] 10.3 Integrace s conflict detection
  - Automatické spuštění detekce při odeslání
  - Zobrazení varování o detekovaných konfliktech
  - Možnost pokračovat i přes varování
  - _Požadavky: 7.1, 7.3, 7.4_

- [ ]* 10.4 Napsání testů pro formuláře
  - E2E testy pro kompletní registrační workflow
  - Testy validace a error handling
  - _Požadavky: 3.1, 3.3_

- [ ] 11. Implementace dashboardu a přehledů
- [ ] 11.1 Vytvoření dashboardu pro koordinátory
  - Přehled projektů čekajících na schválení
  - Statistiky konfliktů a aktivních projektů
  - Seznam nedávných událostí a notifikací
  - _Požadavky: 2.1, 2.2, 2.4_

- [ ] 11.2 Implementace seznamu projektů pro žadatele
  - Tabulkový přehled vlastních projektů
  - Filtrování podle stavu a časového období
  - Rychlé akce (editace, duplikace, zrušení)
  - _Požadavky: 3.1, 3.2_

- [ ] 11.3 Vytvoření detailního pohledu na projekt
  - Kompletní informace o projektu v sidebar panelu
  - Historie změn a komentářů
  - Akční tlačítka podle role uživatele
  - _Požadavky: 8.3, 8.4, 2.4_

- [ ]* 11.4 Napsání testů pro dashboard komponenty
  - Testy zobrazení dat podle uživatelských rolí
  - Testy filtrování a řazení
  - _Požadavky: 2.1, 3.1_

- [ ] 12. Implementace správy moratorií
- [ ] 12.1 Vytvoření formuláře pro moratoria
  - Kreslení omezených oblastí na mapě
  - Formulář s důvodem, časovým obdobím a výjimkami
  - Validace maximální délky 5 let
  - _Požadavky: 4.1, 4.2, 4.5_

- [ ] 12.2 Vizualizace moratorií na mapě
  - Červené šrafování s průhledností 40%
  - Tooltips s informacemi o moratoriu
  - Toggle pro zapnutí/vypnutí vrstvy moratorií
  - _Požadavky: 4.3, 6.3_

- [ ] 12.3 Integrace kontrol moratorií do workflow
  - Automatické varování při registraci v omezené oblasti
  - Možnost koordinátora ignorovat moratorium při schvalování
  - _Požadavky: 4.4, 2.4_

- [ ]* 12.4 Napsání testů pro moratoria
  - Testy vytváření a validace moratorií
  - Testy detekce narušení moratorií
  - _Požadavky: 4.1, 4.4_

- [ ] 13. Implementace komentářového systému
- [ ] 13.1 Vytvoření komentářové komponenty
  - Formulář pro přidávání komentářů s validací délky
  - Zobrazení historie komentářů s časovými razítky
  - Support pro @mentions s automatickými notifikacemi
  - _Požadavky: 8.1, 8.2, 8.4_

- [ ] 13.2 Implementace file upload pro přílohy
  - Upload souborů s validací typu a velikosti
  - Integrace s AWS S3 nebo lokálním úložištěm
  - Preview a download funkcionalita
  - _Požadavky: 8.1_

- [ ]* 13.3 Napsání testů pro komentáře
  - Testy přidávání komentářů a notifikací
  - Testy file upload funkcionalité
  - _Požadavky: 8.1, 8.2_

- [ ] 14. Implementace audit trail a historie
- [ ] 14.1 Vytvoření audit logging systému
  - Automatické logování všech změn projektů
  - Zachycení user ID, IP adresy a timestampu
  - JSON diff pro sledování změn hodnot
  - _Požadavky: 8.3, 8.5_

- [ ] 14.2 Implementace historie projektů
  - Zobrazení timeline všech změn projektu
  - Filtrování dokončených a zrušených projektů
  - Export historie do CSV formátu
  - _Požadavky: 8.3, 8.5_

- [ ]* 14.3 Napsání testů pro audit systém
  - Testy správného logování změn
  - Testy anonymizace citlivých dat
  - _Požadavky: 8.3_

- [ ] 15. Finalizace a optimalizace
- [ ] 15.1 Performance optimalizace
  - Optimalizace PostGIS dotazů s explain analyze
  - Frontend lazy loading a code splitting
  - Caching strategií pro mapové dlaždice
  - _Požadavky: 7.5, 6.5_

- [ ] 15.2 Bezpečnostní hardening
  - HTTPS konfigurace s security headers
  - Rate limiting pro API endpoints
  - Input sanitization a XSS ochrana
  - _Požadavky: 1.4, 7.1_

- [ ] 15.3 Railway deployment a monitoring setup
  - Vytvoření Railway projektu a propojení s GitHub repo
  - Konfigurace PostgreSQL databáze s PostGIS rozšířením
  - Nastavení environment variables pro produkci
  - Konfigurace automatických deploymentů z main branch
  - Integrace Sentry pro error tracking a monitoring
  - _Požadavky: Všechny_

- [ ]* 15.4 Kompletní E2E testování
  - Playwright testy pro všechny user journeys
  - Cross-browser kompatibilita testy
  - Performance a load testing
  - _Požadavky: Všechny_
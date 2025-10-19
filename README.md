# DigiKop - Koordinační systém pro výkopové práce

Web-based coordination platform for excavation works in Central Bohemian Region.

## 🎯 Přehled

DigiKop je moderní webová aplikace pro digitální koordinaci výkopových prací a zásahů do komunikací ve Středočeském kraji. Systém modernizuje proces registrace, schvalování a monitorování výkopů, inspirovaný britským systémem EToN (Electronic Transfer of Notifications), ale přizpůsobený českému prostředí a právnímu rámci.

### Klíčové funkce

- 🗺️ **Interaktivní mapové rozhraní** s vizualizací projektů
- 🔍 **Automatická detekce konfliktů** prostorových a časových překryvů
- 👥 **Role-based přístup** s územními omezeními
- 📧 **Notifikační systém** pro změny stavů projektů
- 📋 **Workflow management** pro schvalovací procesy
- 🚫 **Správa moratorií** pro dočasná omezení

## 🏗️ Architektura

- **Frontend**: React + TypeScript + Mapbox GL JS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + PostGIS
- **Deployment**: Railway.com
- **Authentication**: JWT tokens

## 🚀 Rychlý start

### Předpoklady

- Node.js 18+
- PostgreSQL 15+ s PostGIS rozšířením
- npm nebo yarn

### Instalace

1. **Klonování repozitáře**
   ```bash
   git clone https://github.com/tangero/digikop.git
   cd digikop
   ```

2. **Instalace závislostí**
   ```bash
   npm install
   ```

3. **Konfigurace prostředí**
   ```bash
   cp .env.example .env
   # Upravte .env soubor s vašimi hodnotami
   ```

4. **Spuštění databáze**
   ```bash
   # Lokální PostgreSQL s PostGIS
   createdb digikop_dev
   psql digikop_dev -c "CREATE EXTENSION postgis;"
   ```

5. **Spuštění aplikace**
   ```bash
   npm run dev
   ```

Aplikace bude dostupná na `http://localhost:3000`

## 📁 Struktura projektu

```
digikop/
├── src/                    # Backend zdrojové kódy
│   ├── config/            # Konfigurace databáze a aplikace
│   ├── middleware/        # Express middleware
│   ├── routes/           # API routes
│   ├── types/            # TypeScript definice
│   ├── app.ts            # Express aplikace
│   └── server.ts         # Server entry point
├── frontend/             # React frontend (bude vytvořen)
├── .kiro/               # Kiro specs a dokumentace
├── railway.json         # Railway deployment config
└── package.json
```

## 🔧 Vývoj

### Dostupné skripty

```bash
npm run dev          # Spuštění dev serveru (backend + frontend)
npm run dev:backend  # Pouze backend
npm run dev:frontend # Pouze frontend
npm run build        # Build pro produkci
npm run test         # Spuštění testů
```

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/info` - API informace
- `/api/auth/*` - Autentizace (bude implementováno)
- `/api/projects/*` - Správa projektů (bude implementováno)
- `/api/moratoriums/*` - Správa moratorií (bude implementováno)

## 🚀 Deployment

Aplikace je nakonfigurována pro deployment na Railway.com:

1. **Propojení s Railway**
   ```bash
   # Railway CLI
   railway login
   railway link
   ```

2. **Nastavení proměnných prostředí**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - JWT signing secret
   - `SMTP_*` - Email konfigurace

3. **Deploy**
   ```bash
   git push origin main
   # Automatický deploy přes GitHub integration
   ```

## 📋 Požadavky systému

Systém splňuje následující klíčové požadavky:

- **Req 1.1**: Správa uživatelských účtů s územními oprávněními
- **Req 1.3**: Geografická omezení přístupu podle rolí
- **Req 1.4**: JWT autentizace s bezpečným hashováním hesel

## 🤝 Přispívání

1. Fork repozitáře
2. Vytvořte feature branch (`git checkout -b feature/nova-funkcionalita`)
3. Commit změny (`git commit -am 'Přidání nové funkcionality'`)
4. Push do branch (`git push origin feature/nova-funkcionalita`)
5. Vytvořte Pull Request

## 📄 Licence

Tento projekt je licencován pod MIT licencí - viz [LICENSE](LICENSE) soubor.

## 📞 Kontakt

- **Repository**: https://github.com/tangero/digikop
- **Issues**: https://github.com/tangero/digikop/issues

---

Vytvořeno s ❤️ pro Středočeský kraj
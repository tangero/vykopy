# DigiKop Frontend

React frontend aplikace pro DigiKop - systém koordinace výkopových prací ve Středočeském kraji.

## Technologie

- **React 19** s TypeScript
- **Vite** jako build tool
- **Redux Toolkit** pro state management
- **React Router** pro navigaci
- **ESLint + Prettier** pro code quality

## Spuštění

```bash
# Instalace závislostí
npm install

# Spuštění development serveru
npm run dev

# Build pro produkci
npm run build

# Linting
npm run lint
npm run lint:fix

# Formátování kódu
npm run format
```

## Struktura projektu

```
src/
├── components/     # React komponenty
├── pages/         # Stránky aplikace
├── store/         # Redux store a slices
├── hooks/         # Custom React hooks
├── types/         # TypeScript definice
├── utils/         # Utility funkce
└── router/        # React Router konfigurace
```

## Další kroky

1. Implementace autentizačních komponent (úkol 8.2)
2. Vytvoření základního layoutu (úkol 8.3)
3. Integrace s mapovým rozhraním (úkol 9)
# EXORA Finances

[![CI](https://github.com/LUISGABUAS/EXORA/actions/workflows/ci.yml/badge.svg)](https://github.com/LUISGABUAS/EXORA/actions/workflows/ci.yml)
[![App Store](https://img.shields.io/badge/App_Store-Available-0D96F6?logo=apple&logoColor=white)](https://apps.apple.com/mx/app/exora-finances/id6781416549)

Personal finance app for Mexico, **live on the App Store**. Track expenses and income, set budgets, scan receipts, validate invoices (CFDI) against the SAT and get AI-powered advice about your money and taxes.

Built and shipped end to end by [Luis Gabuardi](https://luisgabuardi.pages.dev): product, mobile app, backend and App Store release.

## Features

- **Expenses and income** with categories, recurring items, multiple currencies, split bills and savings goals.
- **Receipt scanning**: on-device text recognition (ML Kit) plus a server-side parser to fill in amount, merchant and date. Voice input is also supported.
- **Budgets and streaks**: monthly budgets with alerts, rollover of unspent money and a daily logging streak.
- **Mexican tax tools**: CFDI invoices checked live against the SAT web service, deductible expenses, RESICO tax calculator, fiscal report export and SAT deadline reminders.
- **AI advisor**: answers questions about your spending and generates monthly insights through Supabase Edge Functions; the API key never reaches the device.
- **Bank statement import** from PDF.
- **Offline first**: data lives in SQLite on the phone and syncs with Supabase when online.
- **Security**: Face ID / Touch ID lock, Sign in with Apple and Google.
- **iOS home-screen widget** with the month's spending.
- **Subscriptions** with RevenueCat (monthly and yearly plans).

## Tech stack

| Layer | Technology |
| --- | --- |
| App | React Native 0.84, TypeScript (strict), React Navigation |
| State | Zustand stores, persisted with AsyncStorage |
| Local data | SQLite (`react-native-sqlite-storage`) |
| Backend | Supabase: Auth, Postgres, Storage, Edge Functions (Deno) |
| AI | Anthropic Claude models called from Edge Functions |
| Payments | RevenueCat (StoreKit / Google Play Billing) |
| Monitoring | Sentry (integrated; add your DSN in `src/config/keys.ts`) |
| Native | ML Kit text recognition, Vision Camera, biometrics, iOS widget (Swift bridge) |

## Architecture

```
React Native app
 ├─ screens/      UI, one file per screen
 ├─ store/        Zustand stores (expenses, budgets, premium, …)
 ├─ database/     SQLite schema and queries (source of truth on the device)
 ├─ services/     sync, OCR, notifications, RevenueCat, analytics
 └─ utils/        receipt parsing, tax calculations, formatting
        │
        ▼  sync when online
Supabase
 ├─ Postgres + Row Level Security
 └─ Edge Functions
     ├─ ocr-parse          receipt text → structured expense
     ├─ validate-cfdi      CFDI XML → SAT status (vigente / cancelado)
     ├─ ai-insights        monthly spending insights
     └─ financial-advisor  questions about money and taxes
```

The app works fully offline: every write goes to SQLite first and a sync service pushes changes to Supabase. AI and SAT calls run in Edge Functions so secrets stay on the server.

## Quality

- **164 automated tests** (Jest) covering receipt parsing, feature extraction, AI receipt helpers, the SAT tax certificate reader and UI regressions.
- **CI on every push**: type checking, linting and tests run in GitHub Actions.
- TypeScript in strict mode with zero type errors.

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Jest
```

## Running locally

Requirements: Node 22+, Xcode (iOS) or Android Studio, CocoaPods.

```bash
npm install
cd ios && pod install && cd ..
npm run ios        # or: npm run android
```

Client keys are public by design: Supabase URL and anon key in `src/lib/supabase.ts`, RevenueCat public keys in `src/services/revenuecatService.ts`, Sentry DSN in `src/config/keys.ts`. Private keys stay in Supabase: Edge Functions need `ANTHROPIC_API_KEY` and `OCR_SPACE_API_KEY` as secrets.

## Contact

Luis Gabuardi · [luisgabuardi.pages.dev](https://luisgabuardi.pages.dev) · [LinkedIn](https://www.linkedin.com/in/luis-felipe-alejandro-gabuardi-gonzalez-a482a4384/) · gabuasluis@gmail.com

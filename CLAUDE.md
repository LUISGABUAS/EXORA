# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start Metro dev server |
| `npm run ios` | Build and run on iOS simulator |
| `npm run android` | Build and run on Android |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

**iOS setup (after cloning or adding native deps):**
```bash
cd ios && pod install && cd ..
```

## Architecture

**React Native 0.84 + React 19 + TypeScript** app for tracking expenses in Mexico, with OCR receipt scanning and tax deduction features.

### Key Layers

- **Navigation** (`src/navigation/AppNavigator.tsx`): React Navigation 7 with bottom tabs (Dashboard, Scan, History, Settings) + a native stack for `ExpenseDetail`.
- **State** (`src/store/useExpenseStore.ts`): Zustand store holding `expenses[]` and `loading`. Every mutation (add/edit/remove) writes to SQLite then reloads the full list.
- **Database** (`src/database/`): SQLite via `react-native-sqlite-storage`. Singleton connection in `db.ts`, repository pattern in `expenseRepository.ts`. Single DB file `smartexpense-mx.db`, no migrations system yet.
- **Services** (`src/services/`): `exportService.ts` (CSV via react-native-fs + share), `notificationService.ts` (stub/placeholder), `ocr/ocrService.ts` (camera permissions + OCR.Space API).
- **Utils** (`src/utils/`): Mexican-specific business logic — `tax.ts` (RFC validation, deductibility inference), `receiptParser.ts` (extract amount/date/merchant/RFC from OCR text), `classifier.ts` (keyword-based category classification), `format.ts` (currency/date formatting).

### App Bootstrap (App.tsx)

1. `initDatabase()` — create expenses table if missing
2. `configureNotifications()` — placeholder
3. `loadExpenses()` — hydrate Zustand store from SQLite

### Core Types (`src/types/expense.ts`)

- `ExpenseCategory`: `'Comida' | 'Transporte' | 'Entretenimiento' | 'Salud' | 'Educacion' | 'Otros'`
- `Expense`: Full record with `amount`, `date` (YYYY-MM-DD), `category`, `merchantName`, `rfc` (Mexican tax ID), `usoCFDI`, `deductible`, `source` ('manual' | 'ocr'), `ocrRawText`
- `ExpenseInput`: `Omit<Expense, 'id' | 'createdAt'>`
- `ParsedReceiptData`: OCR parser output with optional fields + `suggestedCategory`

## Conventions

- **All UI text in Spanish** — category names, labels, error messages
- **Styling**: `StyleSheet.create()` only, no UI library. Colors from `src/theme/colors.ts` (warm Mexican-inspired palette, primary `#0f766e`, background `#f4efe6`)
- **Prettier**: single quotes, trailing commas, no parens on single arrow params
- **ESLint**: extends `@react-native`

## Environment Variables

- `OCR_SPACE_API_KEY`: Required for receipt OCR functionality (OCR.Space API)

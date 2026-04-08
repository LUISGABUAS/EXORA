# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start Metro dev server |
| `npm run ios` | Build and run on iOS simulator |
| `npm run android` | Build and run on Android |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests (131 tests across 3 suites) |

**iOS setup (after cloning or adding native deps):**
```bash
cd ios && pod install && cd ..
```

## Architecture

**React Native 0.84 + React 19 + TypeScript** app for tracking expenses in Mexico, with OCR receipt scanning, offline AI receipt parsing, and tax deduction features.

### Key Layers

- **Navigation** (`src/navigation/AppNavigator.tsx`): React Navigation 7. Root native stack with auth gate (Login vs authenticated). Authenticated stack: 3 bottom tabs (Inicio, Movimientos, Perfil) + stack screens for `ExpenseDetail` and `Scan`.
- **Auth** (`src/store/useAuthStore.ts`): Zustand store wrapping Supabase Auth. Supports Google Sign-In, email/password, and phone OTP. Session drives the navigation auth gate.
- **State** (`src/store/useExpenseStore.ts`): Zustand store holding `expenses[]` and `loading`. Every mutation (add/edit/remove) writes to SQLite then reloads the full list.
- **Database** (`src/database/`): SQLite via `react-native-sqlite-storage`. Singleton connection in `db.ts`, repository pattern in `expenseRepository.ts`. Sync queue table in `syncQueue.ts`.
- **Sync** (`src/services/syncService.ts`): Offline-first sync. Local writes go to a `sync_queue` SQLite table. `NetInfo` listener auto-flushes pending items to Supabase when connectivity is restored. Processes items in order, stops on first error to preserve sequence.
- **Services** (`src/services/`): `exportService.ts` (CSV via react-native-fs + share), `notificationService.ts` (daily 20:00 + weekly Sunday 10:00 via react-native-push-notification), `ocr/ocrService.ts` (camera permissions + OCR.Space API).
- **AI Receipt Parser** (`src/utils/`): Hybrid AI + regex approach. `receiptAI.ts` runs offline logistic regression (252 params, ~5KB weights from `modelWeights.json`) to classify receipt lines. `receiptExtractors.ts` extracts fields from classified lines. `receiptParser.ts` merges AI results with regex — regex for merchant (brand DB), AI for amount/date/RFC when confident. `featureExtractor.ts` computes 20 features per line.
- **Utils** (`src/utils/`): Mexican-specific business logic — `tax.ts` (RFC validation, deductibility inference), `classifier.ts` (weighted keyword-based category classification, accent-insensitive), `format.ts` (currency/date formatting).

### Theme System (`src/theme/`)

- `ThemeContext.tsx`: `ThemeProvider` + `useTheme()` hook returning `{ colors, isDark, mode, setMode }`
- `colors.ts`: `ColorPalette` type with 16 tokens, `lightColors` exported as default
- `darkColors.ts`: Dark fintech palette
- Modes: `'light' | 'dark' | 'system'`, persisted via AsyncStorage
- Primary palette: `#22C55E` (green), dark bg `#0A0A0A`, light bg `#F5F5F7`
- Pattern: `const { colors, isDark } = useTheme()` in every screen/component

### App Bootstrap (App.tsx)

1. `initDatabase()` — create expenses table if missing
2. `configureNotifications()` — schedule daily + weekly reminders
3. `loadExpenses()` — hydrate Zustand store from SQLite

### Core Types (`src/types/expense.ts`)

- `ExpenseCategory`: `'Comida' | 'Transporte' | 'Entretenimiento' | 'Salud' | 'Educacion' | 'Otros'`
- `Expense`: Full record with `amount`, `date` (YYYY-MM-DD), `category`, `merchantName`, `rfc` (Mexican tax ID), `usoCFDI`, `deductible`, `source` ('manual' | 'ocr'), `ocrRawText`
- `ExpenseInput`: `Omit<Expense, 'id' | 'createdAt'>`
- `ParsedReceiptData`: OCR parser output with optional fields + `suggestedCategory`

## Testing

Tests live in `src/utils/__tests__/` and cover the AI receipt parsing pipeline:
- `featureExtractor.test.ts` — 39 tests for line feature extraction
- `receiptAI.test.ts` — 34 tests for model inference and line classification
- `receiptParser.test.ts` — 58 tests for end-to-end receipt parsing (AI + regex)

## Training Pipeline

Python scripts in `training/` generate synthetic data and train the offline receipt ML model:
- `generate_receipts.py` — generates 1000 synthetic Mexican receipts
- `feature_extractor.py` — extracts 20 features per receipt line
- `train_model.py` — trains logistic regression (20 features × 12 classes = 252 params)
- Output: `src/utils/modelWeights.json` (~5KB), achieving 93% line classification accuracy

```bash
cd training && pip install -r requirements.txt
python generate_receipts.py && python train_model.py
```

## Conventions

- **All UI text in Spanish** — category names, labels, error messages
- **Styling**: `StyleSheet.create()` only, no UI library. Colors from `src/theme/colors.ts` (dark fintech palette, primary `#22C55E`, dark bg `#0A0A0A`, light bg `#F5F5F7`). Use `useTheme()` hook for dynamic colors.
- **Prettier**: single quotes, trailing commas, no parens on single arrow params
- **ESLint**: extends `@react-native`

## Environment Variables

- `OCR_SPACE_API_KEY`: Required for receipt OCR functionality (OCR.Space API)

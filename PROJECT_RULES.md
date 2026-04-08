# PROJECT_RULES.md — SmartExpenseMX2

Documento de reglas oficiales del proyecto. Todo desarrollador que contribuya al codebase **debe** leer y seguir estas reglas. No son sugerencias.

---

## 1. Proposito del Proyecto

SmartExpenseMX2 es una app movil (iOS/Android) para **registro y seguimiento de gastos personales en Mexico**. Funciona 100% offline con sincronizacion opcional a la nube.

### Que hace

- Registro manual de gastos con categoria, monto, fecha, comercio
- Escaneo de tickets fisicos via camara (OCR) con extraccion automatica de datos
- Parsing de facturas CFDI (XML) del SAT
- Clasificacion automatica por categoria usando IA offline
- Calculo de deducibilidad fiscal (RFC, uso de CFDI)
- Dashboard con graficas de gastos por categoria y tendencias
- Exportacion a CSV
- Sincronizacion a Supabase cuando hay conexion
- Modo oscuro

### Para quien

Usuarios en Mexico que necesitan controlar sus gastos y llevar registro fiscal. La app respeta la legislacion fiscal mexicana (RFC, CFDI, categorias de deduccion del SAT).

---

## 2. Reglas de Negocio

### 2.1 Gastos (Expenses)

| Regla | Descripcion |
|-------|-------------|
| Monto obligatorio | Todo gasto debe tener `amount > 0`. No se permiten gastos en $0 ni negativos. |
| Fecha obligatoria | Formato `YYYY-MM-DD`. Si no se proporciona, se usa la fecha actual. |
| Categoria obligatoria | Debe ser exactamente una de: `Comida`, `Transporte`, `Entretenimiento`, `Salud`, `Educacion`, `Otros`. No hay categorias dinamicas. |
| Fuente (source) | Solo `manual` o `ocr`. Indica como se registro el gasto. |
| RFC | Formato mexicano: `[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}`. Se valida con `isValidMexicanRfc()`. Si no es valido, se guarda como string vacio. |
| RFCs genericos | `XAXX010101000` y `XEXX010101000` son RFCs genericos del SAT. Se filtran al buscar el RFC real del comercio. |
| Deducibilidad | Se infiere automaticamente: es deducible si el texto contiene keywords de factura (`factura`, `cfdi`, `iva`, `uuid`, `regimen fiscal`, `folio fiscal`) **O** si tiene RFC valido + uso CFDI. |
| Moneda | Todos los montos son en MXN (pesos mexicanos). No hay soporte multi-moneda. |
| Maximo razonable | Montos mayores a $1,000,000 MXN se descartan como error de OCR. |

### 2.2 Clasificacion Automatica

- Se usa un sistema de **keywords con pesos** (weight 1-10) por categoria.
- El texto se normaliza: minusculas + se eliminan acentos Unicode (`cafe` = `café`).
- Se suman los pesos de todos los keywords que aparecen en el texto.
- La categoria con mayor score gana. Si ninguna tiene score, se asigna `Otros`.
- Los keywords incluyen marcas mexicanas reales (OXXO, Walmart, PEMEX, etc.).

### 2.3 Parsing de Tickets (OCR)

- Se ejecuta un **modelo ML offline** (regresion logistica) que clasifica cada linea del ticket en 12 tipos: `MERCHANT`, `ADDRESS`, `RFC_LINE`, `DATE`, `PRODUCT`, `SUBTOTAL`, `TAX`, `TOTAL`, `PAYMENT`, `CHANGE`, `DECORATION`, `NOISE`.
- En paralelo se ejecuta el **parser regex** con base de datos de marcas conocidas.
- Se hace merge por campo: regex siempre gana para merchant (tiene BD de marcas), AI gana para amount/date/RFC cuando la confianza es alta.
- Si AI y regex dan montos diferentes, **regex gana** (tiene mas heuristicas para edge cases como OCR fragmentado).
- El parser soporta 10 formatos de ticket: OXXO, Walmart, restaurante, gasolinera, cafeteria, farmacia, tienda departamental, ride-hailing, Sam's/Costco, generico.

### 2.4 Sincronizacion

- **Offline-first**: la BD local (SQLite) es la fuente de verdad.
- Toda mutacion (crear/editar/eliminar) se escribe primero a SQLite, luego se encola en `sync_queue`.
- Cuando hay conexion (NetInfo listener), la cola se procesa en orden FIFO.
- Si un item falla al sincronizar, se detiene el procesamiento para preservar el orden.
- Los deletes remotos son **soft deletes** (se actualiza `deleted_at`, no se borra el registro).
- La sincronizacion requiere sesion autenticada. Sin sesion, la cola se acumula.

### 2.5 Notificaciones

- Recordatorio diario a las 20:00 para registrar gastos del dia.
- Resumen semanal los domingos a las 10:00.
- Implementado con `react-native-push-notification`.

---

## 3. Arquitectura y Decisiones Tecnicas

### 3.1 Stack

| Capa | Tecnologia | Version |
|------|------------|---------|
| Runtime | React Native | 0.84 |
| UI Framework | React | 19 |
| Lenguaje | TypeScript | 5.8 |
| Estado | Zustand | 5 |
| BD Local | SQLite (`react-native-sqlite-storage`) | 6 |
| BD Remota | Supabase | 2.100+ |
| Navegacion | React Navigation | 7 |
| OCR | ML Kit Text Recognition | 2 |
| Animaciones | Reanimated | 4 |
| Iconos | react-native-vector-icons (Ionicons) | 10 |

### 3.2 Estructura del Proyecto

```
src/
  navigation/     → Navegacion (tabs + stack)
  screens/        → Pantallas completas
  components/     → Componentes reutilizables
  store/          → Zustand stores (estado global)
  database/       → SQLite: conexion, repositorio, cola de sync
  services/       → Logica de negocio: sync, export, OCR, notificaciones
  lib/            → Clientes externos (Supabase)
  theme/          → Colores, spacing, iconos, ThemeContext
  types/          → Tipos TypeScript compartidos
  utils/          → Funciones puras: parser, clasificador, tax, formato
training/         → Pipeline Python para entrenar modelo ML (no se despliega)
```

### 3.3 Patrones

| Patron | Donde se usa | Descripcion |
|--------|-------------|-------------|
| **Repository** | `database/expenseRepository.ts` | CRUD centralizado con normalizacion de filas SQLite |
| **Store (Zustand)** | `store/useExpenseStore.ts` | Estado global reactivo, cada mutacion escribe a BD y recarga |
| **Singleton** | `database/db.ts` | Una sola conexion SQLite via `getDatabase()` |
| **Offline Queue** | `database/syncQueue.ts` | Cola FIFO de operaciones pendientes de sincronizar |
| **Merge Strategy** | `utils/receiptParser.ts` | AI + regex, el mejor resultado por campo gana |
| **ThemeProvider** | `theme/ThemeContext.tsx` | Context + AsyncStorage para tema light/dark |

### 3.4 Flujo de Arranque (Bootstrap)

```
App.tsx mount
  1. initializeAuth()      → Recupera sesion de Supabase/AsyncStorage
  2. initDatabase()        → CREATE TABLE IF NOT EXISTS (expenses + sync_queue)
  3. loadExpenses()        → SELECT * FROM expenses → Zustand store
  4. configureNotifications() → Programa notificaciones locales
  5. startSyncService()    → NetInfo listener + flush inicial de cola
```

---

## 4. Convenciones de Codigo

### 4.1 Prettier (obligatorio)

```js
// .prettierrc.js
{
  arrowParens: 'avoid',      // x => x, no (x) => x
  singleQuote: true,         // 'comillas simples'
  trailingComma: 'all',      // coma al final en objetos/arrays
}
```

### 4.2 ESLint

```js
// .eslintrc.js
{ extends: '@react-native' }
```

Ejecutar `npm run lint` antes de cada PR. **Cero errores tolerados.**

### 4.3 Nombres de Archivos

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Pantalla | `PascalCase` + `Screen.tsx` | `DashboardScreen.tsx` |
| Componente | `PascalCase.tsx` | `ExpenseCard.tsx` |
| Store | `use` + `PascalCase.ts` | `useExpenseStore.ts` |
| Servicio | `camelCase.ts` | `syncService.ts` |
| Utilidad | `camelCase.ts` | `receiptParser.ts` |
| Tipo | `camelCase.ts` | `expense.ts` |
| Test | `nombre.test.ts` | `receiptParser.test.ts` |

### 4.4 Nombres en Codigo

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Funciones | `camelCase`, verbo | `classifyExpense()`, `findAmount()` |
| Componentes | `PascalCase` | `ExpenseForm`, `StatCard` |
| Tipos/Interfaces | `PascalCase` | `Expense`, `ColorPalette`, `SyncQueueItem` |
| Constantes | `UPPER_SNAKE_CASE` | `KNOWN_BRANDS`, `GENERIC_RFCs` |
| Variables | `camelCase` | `merchantName`, `lineItems` |
| Booleanos | Prefijo `is`/`has`/`can` | `isDark`, `hasPrice`, `deductible` |
| Callbacks | Prefijo `on`/`handle` | `onPress`, `handleSubmit` |

### 4.5 Imports

Orden de imports (no se aplica automaticamente, pero se respeta por convencion):
1. React / React Native
2. Librerias externas
3. Navegacion / store
4. Servicios / database
5. Componentes locales
6. Utils / types / theme

### 4.6 Comentarios

- **NO agregar** comentarios obvios (`// increment counter`).
- **SI agregar** comentarios cuando la logica no es evidente (regex complejos, decisiones de negocio).
- Secciones de archivos largos se separan con headers:
  ```typescript
  // ═══════════════════════════════════════════
  // AMOUNT — Deteccion de monto total
  // ═══════════════════════════════════════════
  ```
- Comentarios en espanol cuando describen logica de negocio mexicana.

---

## 5. Reglas para Desarrollo

### 5.1 Agregar una Nueva Pantalla

1. Crear `src/screens/NuevaPantallaScreen.tsx`
2. Usar `ScreenContainer` como wrapper
3. Obtener tema: `const { colors, isDark } = useTheme()`
4. Crear `useStyles(colors, isDark)` con `StyleSheet.create()`
5. Todo texto visible en **espanol**
6. Registrar en `AppNavigator.tsx` (tab o stack segun corresponda)

### 5.2 Agregar un Nuevo Componente

1. Crear `src/components/NuevoComponente.tsx`
2. Recibir `colors` y `isDark` como props **o** usar `useTheme()` internamente
3. Estilos via `StyleSheet.create()` — **nunca** estilos inline excepto valores dinamicos
4. Exportar como named export, no default

### 5.3 Modificar la Base de Datos

- No hay sistema de migraciones. Los cambios de esquema se hacen en `initDatabase()` con `CREATE TABLE IF NOT EXISTS`.
- Para agregar columnas a tablas existentes, usar `ALTER TABLE ADD COLUMN` con valor default.
- Actualizar `normalizeExpense()` en el repositorio.
- Actualizar los tipos en `expense.ts`.
- Actualizar el sync service si el campo debe sincronizarse.

### 5.4 Manejo de Errores

| Capa | Estrategia |
|------|-----------|
| Database | Las funciones del repositorio **lanzan** excepciones. El caller debe atraparlas. |
| Store | `try/finally` para manejar el flag `loading`. Errores se propagan. |
| Screens | `try/catch` en handlers de UI. Mostrar error con `Alert.alert()`. |
| Sync | `try/catch` por item. Se detiene al primer error para preservar orden FIFO. |
| OCR | Reintentar hasta 2 veces si el resultado es corto. Mostrar banner de error. |
| Forms | Validacion inline. Errores en estado local del componente. |

**Nunca** silenciar errores con `catch {}` vacio. Minimo `console.error()`.

### 5.5 Agregar un Nuevo Campo a Expense

1. Agregar al tipo `Expense` en `src/types/expense.ts`
2. Agregar al tipo `ExpenseInput`
3. Agregar columna en `initDatabase()` con `DEFAULT`
4. Actualizar `normalizeExpense()` en `expenseRepository.ts`
5. Actualizar `createExpense()` y `updateExpense()` en el repositorio
6. Actualizar `processItem()` en `syncService.ts` (mapear camelCase → snake_case)
7. Actualizar `ExpenseForm.tsx` si es editable por el usuario

### 5.6 Testing

- Los tests van en `__tests__/` dentro del mismo directorio que el archivo testeado.
- Usar `describe()` para agrupar por feature/seccion.
- Nombrar tests en espanol: `it('detecta total en OXXO ($52.78)')`.
- Para tests de accuracy con data bulk, usar umbrales realistas (no 100%).
- Ejecutar `npm test` antes de cada PR.

---

## 6. Reglas de Base de Datos

### 6.1 SQLite (Local)

#### Esquema `expenses`

```sql
CREATE TABLE expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  amount        REAL    NOT NULL,          -- Monto en MXN
  date          TEXT    NOT NULL,          -- YYYY-MM-DD
  category      TEXT    NOT NULL,          -- Comida|Transporte|...|Otros
  description   TEXT    DEFAULT '',        -- Descripcion libre
  merchantName  TEXT    DEFAULT '',        -- Nombre del comercio
  conceptsText  TEXT    DEFAULT '',        -- Resumen de productos
  ocrRawText    TEXT    DEFAULT '',        -- Texto OCR crudo (audit trail)
  deductible    INTEGER DEFAULT 0,         -- 0=false, 1=true
  rfc           TEXT    DEFAULT '',        -- RFC del comercio
  usoCFDI       TEXT    DEFAULT '',        -- Clave uso CFDI (ej: G03)
  source        TEXT    NOT NULL,          -- manual|ocr
  createdAt     TEXT    NOT NULL           -- ISO timestamp
);
```

#### Esquema `sync_queue`

```sql
CREATE TABLE sync_queue (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  action            TEXT    NOT NULL,          -- insert|update|delete
  expense_local_id  INTEGER NOT NULL,          -- FK a expenses.id
  payload           TEXT    NOT NULL DEFAULT '{}',  -- JSON serializado
  synced            INTEGER NOT NULL DEFAULT 0,     -- 0=pendiente, 1=sincronizado
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Reglas de Naming (SQLite)

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Tabla | `snake_case` | `sync_queue` |
| Columna (expenses) | `camelCase` | `merchantName`, `ocrRawText` |
| Columna (sync_queue) | `snake_case` | `expense_local_id`, `created_at` |

> Nota: la tabla `expenses` usa camelCase por decision historica. Nuevas tablas deben usar `snake_case`.

#### Reglas de Queries

- **Siempre** usar parametros (`?`) — nunca concatenar valores en SQL.
- Ordenar por `date DESC, id DESC` para mostrar los mas recientes primero.
- Booleanos se almacenan como `INTEGER` (0/1) y se normalizan con `Boolean()` al leer.
- No usar `SELECT *` en queries nuevas — listar columnas explicitamente.

### 6.2 Supabase (Remoto)

#### Naming Remoto

Los campos en Supabase usan `snake_case`:

| Local (SQLite) | Remoto (Supabase) |
|----------------|-------------------|
| `merchantName` | `merchant_name` |
| `conceptsText` | `concepts_text` |
| `ocrRawText` | `ocr_raw_text` |
| `usoCFDI` | `uso_cfdi` |

El mapeo se hace en `syncService.ts` dentro de `processItem()`.

#### Campos Extra en Supabase

- `user_id` — ID del usuario autenticado (FK)
- `local_id` — ID local del expense en SQLite
- `updated_at` — Timestamp de ultima actualizacion
- `deleted_at` — Timestamp de soft delete (nunca se borran registros)

---

## 7. Reglas de Seguridad

### 7.1 Autenticacion

- Tres metodos: email/password, telefono (OTP), Google Sign-In.
- La sesion se persiste en AsyncStorage (encriptado a nivel de dispositivo).
- Se usa el listener `onAuthStateChange` de Supabase para detectar cambios de sesion.
- AppState listener para refresh de token cuando la app vuelve al foreground.

### 7.2 Datos Sensibles

| Dato | Tratamiento |
|------|-------------|
| RFC | Se almacena en texto plano en SQLite y Supabase. No es dato sensible en contexto fiscal mexicano (es publico). |
| Tokens de sesion | Manejados por Supabase SDK via AsyncStorage. No se almacenan manualmente. |
| Texto OCR | Se guarda en `ocrRawText` para audit trail. Puede contener datos del ticket. |
| Google IdToken | Se usa una sola vez para auth, no se persiste. |

### 7.3 Lo que NO hacer

- **NUNCA** loguear tokens, sesiones o credenciales con `console.log()`.
- **NUNCA** enviar imagenes de tickets a servicios externos — el OCR es 100% local (ML Kit).
- **NUNCA** hacer queries SQL concatenando strings — siempre parametrizar con `?`.
- **NUNCA** almacenar la Supabase `service_role` key en el cliente. Solo se usa `anon` key.
- **NUNCA** desactivar Row Level Security (RLS) en Supabase en produccion.

### 7.4 Supabase RLS

Las politicas de Row Level Security deben asegurar:
- Un usuario solo puede leer/escribir/eliminar sus propios gastos (`user_id = auth.uid()`).
- Un usuario solo puede leer/escribir su propio perfil.
- No hay acceso publico a ninguna tabla.

---

## 8. Reglas de UI/UX

### 8.1 Idioma

**Todo el texto visible al usuario debe estar en espanol mexicano.**

Esto incluye: labels, placeholders, mensajes de error, nombres de categorias, botones, toasts, alerts, headers de navegacion.

Correcto: `"Registrar gasto"`, `"Monto invalido"`
Incorrecto: `"Add expense"`, `"Invalid amount"`

### 8.2 Sistema de Colores

Los colores se definen en `src/theme/colors.ts` (light) y `src/theme/darkColors.ts` (dark). **Nunca** usar colores hardcodeados en componentes.

#### Paleta Light

| Token | Hex | Uso |
|-------|-----|-----|
| `background` | `#f4efe6` | Fondo general (beige calido) |
| `surface` | `#fffaf4` | Tarjetas, modales |
| `surfaceAlt` | `#f0e6d6` | Fondo alternativo |
| `text` | `#1f1a17` | Texto principal |
| `textMuted` | `#74685f` | Texto secundario |
| `primary` | `#0f766e` | Acciones principales, botones, tabs activos |
| `secondary` | `#c96f3b` | Acentos, iconos secundarios |
| `accent` | `#355c7d` | Links, elementos informativos |
| `danger` | `#b42318` | Errores, eliminar |
| `warning` | `#d97706` | Alertas |
| `success` | `#157f3b` | Confirmaciones |
| `border` | `#ddcfbd` | Bordes, separadores |

### 8.3 Sistema de Estilos

```typescript
// PATRON OBLIGATORIO en cada componente/pantalla:

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
  });

// En el componente:
const { colors, isDark } = useTheme();
const s = useStyles(colors, isDark);
```

**Prohibido:**
- `styled-components`, `tailwind`, o cualquier libreria de estilos
- Estilos inline (excepto valores dinamicos como `{ opacity: isActive ? 1 : 0.5 }`)
- Colores hardcodeados (`#ff0000`) en vez de tokens del tema (`colors.danger`)
- `StyleSheet.create()` fuera de la funcion `useStyles`

### 8.4 Spacing y Radii

Usar los tokens de `src/theme/spacing.ts`:

```typescript
spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }
radii:   { sm: 12, md: 18, lg: 24, xl: 28, full: 999 }
```

### 8.5 Iconos

- Libreria: `react-native-vector-icons/Ionicons`
- Mapeo de iconos por categoria en `src/theme/icons.ts`
- No mezclar familias de iconos (usar solo Ionicons)

### 8.6 Componentes de Layout

- Toda pantalla debe estar envuelta en `ScreenContainer` (SafeAreaView + ScrollView)
- Modales usan el `Modal` nativo de React Native
- Formularios usan `ExpenseForm` (componente reutilizable)

### 8.7 Animaciones

- Se usa Reanimated para animaciones de entrada (`FadeInDown`)
- No usar `Animated` API nativa para animaciones nuevas — usar Reanimated
- Mantener animaciones sutiles (< 400ms)

### 8.8 Formato de Datos Visible

| Dato | Formato | Funcion |
|------|---------|---------|
| Moneda | `$1,234.56` (locale es-MX) | `formatCurrency()` |
| Fecha | `15 mar 2024` | `formatDate()` |
| Fecha input | `YYYY-MM-DD` | `toInputDate()` |

---

## 9. Restricciones y Decisiones Importantes

### Lo que NO se debe hacer

| Prohibicion | Razon |
|-------------|-------|
| Agregar categorias dinamicas | Las 6 categorias (`Comida`, `Transporte`, etc.) estan hardcodeadas en tipos, clasificador, iconos y colores. Cambiarlas requiere actualizar 10+ archivos. |
| Usar una libreria de UI (NativeBase, Paper, etc.) | El proyecto usa `StyleSheet.create()` puro con tema propio. Agregar una libreria romperia la consistencia. |
| Enviar imagenes a APIs externas | El OCR es local (ML Kit). Enviar imagenes compromete la privacidad del usuario. |
| Usar `any` en TypeScript | Excepto en la capa de normalizacion de SQLite (`normalizeExpense`), donde `row: any` viene del driver. En todo lo demas, tipar correctamente. |
| Hacer hard-deletes en Supabase | Los deletes remotos deben ser soft (`deleted_at`). Esto permite recovery y audit trail. |
| Cambiar el orden de la sync queue | La cola se procesa en FIFO estricto. Si un item falla, se detiene. No reordenar ni saltar items. |
| Usar `console.log()` en produccion | Usar solo para debugging temporal. En produccion, usar `console.error()` solo para errores reales. |
| Texto en ingles en la UI | La app es 100% en espanol. Ni labels, ni placeholders, ni mensajes de error en ingles. |
| Crear archivos `.md` sin que se pidan | No generar documentacion automatica (README, CHANGELOG) a menos que se pida explicitamente. |
| Push force a main | Nunca. |

### Decisiones Arquitectonicas Inmutables

| Decision | Justificacion |
|----------|--------------|
| **Offline-first** | Los usuarios mexicanos pueden tener conectividad intermitente. SQLite es la fuente de verdad. |
| **OCR local** | Privacidad. Las imagenes de tickets pueden contener datos fiscales sensibles (RFC, nombre, direccion). |
| **Modelo ML embebido** | El modelo de 252 parametros (5KB) corre en < 5ms. No justifica una API remota. |
| **Zustand (no Redux)** | Menor boilerplate para un proyecto de este tamaño. No hay side-effects complejos que justifiquen Redux. |
| **SQLite (no Realm/WatermelonDB)** | Menor dependencia nativa, queries SQL directas, compatible con sync manual a Supabase. |
| **React Navigation 7** | Standard de la industria para React Native. Soporte de deep linking y tipado. |

### Deuda Tecnica Conocida

| Deuda | Impacto | Prioridad |
|-------|---------|-----------|
| Sin sistema de migraciones | Agregar campos requiere ALTER TABLE manual | Media |
| Credenciales hardcodeadas | Supabase keys y Google client IDs estan en el codigo fuente | Alta (antes de produccion) |
| App.test.tsx roto | El test de la app falla por mock de react-native-gesture-handler | Baja |
| Sin error boundary | Errores no capturados muestran pantalla blanca | Media |
| `expenses` usa camelCase | Inconsistencia con `sync_queue` que usa snake_case | Baja |

---

## 10. Checklist para Pull Requests

Antes de enviar un PR, verificar:

- [ ] `npm run lint` — 0 errores
- [ ] `npx tsc --noEmit` — sin errores nuevos en archivos modificados
- [ ] `npm test` — todos los tests pasan (ignorar App.test.tsx pre-existente)
- [ ] Todo texto de UI esta en espanol
- [ ] No hay colores hardcodeados — se usan tokens de `colors.ts`
- [ ] Estilos via `StyleSheet.create()` dentro de `useStyles()`
- [ ] Queries SQL usan parametros (`?`), no concatenacion
- [ ] Si se agrego campo a BD: actualizar tipo + repositorio + sync service
- [ ] Si se agrego pantalla: usa `ScreenContainer` + `useTheme()`
- [ ] No hay `console.log()` de debugging (solo `console.error()` para errores reales)
- [ ] No hay `any` nuevos (excepto capa SQLite)

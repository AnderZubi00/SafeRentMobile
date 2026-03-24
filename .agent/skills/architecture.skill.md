# Architecture Skill — SafeRentMobile

Reference for the overall app architecture, module structure, context layers, and backend communication.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Expo 54 / React Native 0.81 / React 19 |
| Router | Expo Router v6 (file-based) |
| Styling | NativeWind 4 (TailwindCSS for RN, `className` props) |
| Backend API | NestJS 11 (via `lib/api.ts` -> `EXPO_PUBLIC_API_URL`) |
| Auth & Storage | Supabase (Auth state + Storage URLs only) |
| Types | TypeScript strict, path alias `@/*` |
| Icons | Lucide React Native |
| Session | AsyncStorage (tokens) + Expo Secure Store |

---

## Route Structure

```
app/
├── _layout.tsx               # Root layout (AuthProvider)
├── index.tsx                 # Entry redirect
├── kyc-movil.tsx             # Mobile KYC flow (standalone)
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/
│   ├── _layout.tsx           # Tab navigator (role-gated via href: null)
│   ├── profile.tsx           # User profile (all roles)
│   ├── (explore)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx         # Property listings (all roles)
│   │   └── vivienda/[id].tsx # Property detail
│   ├── (inquilino)/          # Tenant dashboard (INQUILINO only)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── documentos.tsx
│   │   ├── pagos.tsx
│   │   └── reservas.tsx
│   ├── (propietario)/        # Landlord dashboard (PROPIETARIO only)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── publicar.tsx
│   │   ├── solicitudes.tsx
│   │   ├── contratos.tsx
│   │   └── liquidaciones.tsx
│   └── (admin)/              # Admin panel (ADMINISTRADOR only)
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── disputas.tsx
│       └── verificacion.tsx
```

Tabs shown/hidden via `href: null` based on user role from `AuthContext`.

---

## 3 Context Layers

| Context | File | Scope |
|---|---|---|
| AuthContext | `context/AuthContext.tsx` | All authenticated users — session, role, user object |
| InquilinoContext | `context/InquilinoContext.tsx` | Tenant data: solicitudes, documentos, pagos |
| PropietarioContext | `context/PropietarioContext.tsx` | Landlord data: viviendas, solicitudes, pagos |

- Root layout (`app/_layout.tsx`) wraps **only** `AuthProvider`.
- Role-specific contexts are consumed inside their respective tab groups.
- All contexts expose `recargar()` for manual refresh and `cargando` for loading state.

---

## Backend Communication (CRITICAL)

```
lib/api.ts -> NestJS backend (EXPO_PUBLIC_API_URL, default http://localhost:3001)
```

- **JWT** stored in AsyncStorage (key: `"saferent_jwt"`)
- Auto-injected via `Authorization: Bearer` header on every `api.*` call
- Methods: `api.get()`, `api.post()`, `api.patch()`, `api.delete()`
- **Auth flow**: Supabase Auth -> `POST /api/v1/auth/exchange` -> SafeRent JWT -> stored with `setBackendToken()`
- **Supabase is ONLY for**: auth state listener (`onAuthStateChange`) and storage display URLs
- **Never** call Supabase tables directly for business data — always go through the NestJS API

---

## Service Functions (`lib/`)

| File | Purpose |
|---|---|
| `lib/api.ts` | HTTP client to NestJS backend (JWT auto-injection) |
| `lib/auth.ts` | Login, register, fetch current user |
| `lib/viviendas.ts` | Property CRUD and search/filter |
| `lib/solicitudes.ts` | Application lifecycle (create, accept, reject) |
| `lib/contratos.ts` | Digital contracts |
| `lib/pagos.ts` | Payments |
| `lib/utils.ts` | Shared helpers (e.g., `formatCurrency`) |
| `lib/supabase.ts` | Supabase client init (AsyncStorage session persistence) |

All service functions return `{ data: T | null, error: string | null }` tuples with user-facing error messages in Spanish.

---

## Special Lib Files

| File | Purpose |
|---|---|
| `lib/bac.ts` | NFC Basic Access Control (BAC) for electronic passports |
| `lib/nfc-passport.ts` | NFC passport chip reading (ICAO 9303) |
| `lib/supabase.ts` | Supabase client init with AsyncStorage session persistence |

---

## Decision Tree

```
Task involves backend data?
├── YES -> Use lib/api.ts (NestJS), NEVER direct Supabase queries
│   ├── Need auth? -> Supabase Auth -> /api/v1/auth/exchange -> SafeRent JWT
│   └── CRUD on viviendas/solicitudes/contratos/pagos? -> use lib/<service>.ts
├── Need file uploads / image display?
│   └── Storage URLs from Supabase, upload via NestJS API
└── Auth state only?
    └── Use Supabase onAuthStateChange + AsyncStorage persistence
```

---

## Guardrails

1. **No direct Supabase table access** — All business data flows through NestJS backend via `lib/api.ts`.
2. **KYC gate** — No INQUILINO can create a solicitud or contact a PROPIETARIO without `verificado_kyc: true`.
3. **Role isolation** — Context providers are scoped to their tab groups; never import `InquilinoContext` in propietario screens or vice versa.
4. **Spanish UI** — All user-facing text and error messages must be in Spanish.
5. **TypeScript strict** — No `any` types. All API responses must be typed.
6. **JWT lifecycle** — Always use `setBackendToken()` / `getBackendToken()` from `lib/api.ts`. Never manually read/write the `saferent_jwt` AsyncStorage key elsewhere.

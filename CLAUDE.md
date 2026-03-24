# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skill Orchestration

Este proyecto usa un sistema de Skills con Lazy Loading. Lee `AGENT.md` para las reglas de activación y carga `.agent/skills/<skill>.md` según el dominio de la tarea. No cargues todos los skills al inicio.

## Commands

```bash
npm start          # Start Expo dev server (all platforms)
npm run ios        # Start on iOS simulator
npm run android    # Start on Android emulator
npm run web        # Start on web browser
```

EAS builds:
```bash
eas build --platform android --profile development
eas build --platform ios --profile preview
```

No test or lint commands are configured.

## Environment Variables

Required in app config or `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=              # NestJS backend URL (default: http://localhost:3001)
```

## Architecture

SafeRentMobile is a React Native app (Expo 54 + TypeScript) for a rental marketplace with three user roles: **INQUILINO** (Tenant), **PROPIETARIO** (Landlord), and **ADMINISTRADOR** (Admin).

### Routing

Uses **Expo Router v6** (file-based routing). Key groups under `app/`:
- `(auth)/` — Login/register screens
- `(tabs)/` — Main tab navigation, with role-gated sub-groups:
  - `(explore)/` — Property listings (all roles)
  - `(inquilino)/` — Tenant dashboard (INQUILINO only)
  - `(propietario)/` — Landlord dashboard (PROPIETARIO only)
  - `(admin)/` — Admin panel (ADMINISTRADOR only)
- `kyc-movil.tsx` — Standalone mobile KYC verification flow

Tabs are conditionally shown using `href: null` based on the user's role.

### State Management

Three **React Context** providers (no Redux):
- `AuthContext` — Auth state, session persistence via AsyncStorage, Supabase auth listener
- `PropietarioContext` — Landlord data (viviendas, solicitudes, pagos) loaded in parallel
- `InquilinoContext` — Tenant data (solicitudes, documentos, pagos)

Root layout (`app/_layout.tsx`) wraps only `AuthProvider`; role-specific contexts are consumed deeper in the tree. Contexts expose a `recargar()` function for manual refresh and a `cargando` boolean for loading state.

### Backend API (NestJS)

All business data is fetched from the NestJS backend via `lib/api.ts`:
- **URL**: `EXPO_PUBLIC_API_URL` env var (default: `http://localhost:3001`)
- **Auth**: Supabase token -> POST /api/v1/auth/exchange -> SafeRent JWT -> stored in AsyncStorage
- **All api.* calls** auto-inject JWT via Authorization header

**Supabase** is used ONLY for:
- Auth state management (onAuthStateChange, session persistence via AsyncStorage)
- Storage URLs (displaying uploaded images/documents)

Key tables (managed by NestJS backend, NOT accessed directly): `usuarios`, `viviendas`, `solicitudes`, `contratos`, `pagos`.

Service functions live in `lib/`:
- `lib/api.ts` — HTTP client to NestJS backend (JWT auto-injection)
- `lib/supabase.ts` — Client init (AsyncStorage session persistence)
- `lib/auth.ts` — Login, register, fetch current user
- `lib/viviendas.ts` — Property CRUD and search/filter
- `lib/solicitudes.ts` — Application lifecycle (create, accept, reject)
- `lib/contratos.ts` — Digital contracts
- `lib/pagos.ts` — Payments
- `lib/utils.ts` — Shared helpers (e.g., `formatCurrency`)
- `lib/bac.ts` — NFC Basic Access Control (BAC) for e-passports
- `lib/nfc-passport.ts` — NFC passport chip reading (ICAO 9303)

All service functions return `{ data: T | null, error: string | null }` tuples with user-facing error messages in Spanish.

### Styling

**NativeWind 4** (TailwindCSS for React Native). Use `className` props. Custom theme tokens in `tailwind.config.ts`: primary indigo (`#6366f1`), per-role accent colors (green for tenant, indigo for landlord, rose for admin).

### Path Aliases

`@/*` resolves to the project root (e.g., `import { useAuth } from "@/context/AuthContext"`).

### Language

All UI text and error messages are in **Spanish**.

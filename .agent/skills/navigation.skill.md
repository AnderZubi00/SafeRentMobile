# Skill: Navegación con Expo Router

**Activar cuando**: rutas, layouts, tabs, navegación entre pantallas, guards, deep links, back navigation.

---

## Estructura de Rutas del Proyecto

```
app/
├── _layout.tsx              ← Root: AuthProvider
├── index.tsx                ← Redirect según rol
├── (auth)/
│   ├── _layout.tsx          ← Stack sin header
│   ├── login.tsx
│   └── register.tsx
└── (tabs)/
    ├── _layout.tsx          ← Tab navigator (role-gated)
    ├── profile.tsx          ← Visible a todos los roles
    ├── (explore)/
    │   ├── index.tsx
    │   └── vivienda/[id].tsx
    ├── (inquilino)/         ← Solo INQUILINO
    │   ├── index.tsx
    │   ├── reservas.tsx
    │   ├── pagos.tsx
    │   ├── documentos.tsx
    │   └── verificar-identidad.tsx
    ├── (propietario)/       ← Solo PROPIETARIO
    │   ├── index.tsx
    │   ├── publicar.tsx
    │   ├── solicitudes.tsx
    │   ├── contratos.tsx
    │   └── liquidaciones.tsx
    └── (admin)/             ← Solo ADMINISTRADOR
        ├── index.tsx
        ├── verificacion.tsx
        └── disputas.tsx
```

---

## Guard de Autenticación (Root Layout)

```typescript
// app/_layout.tsx
import { useAuth } from "@/context/AuthContext";
import { Redirect, Slot } from "expo-router";

export default function RootLayout() {
  const { usuario, cargando } = useAuth();

  if (cargando) return <SplashScreen />;
  if (!usuario) return <Redirect href="/(auth)/login" />;
  return <Slot />;
}
```

## Guard de Rol en Tabs

```typescript
// app/(tabs)/_layout.tsx
const { usuario } = useAuth();
const rol = usuario?.rol;

// Ocultar tab con href: null — NO renderizar condicionalmente el componente Tab
<Tabs.Screen
  name="(inquilino)"
  options={{
    href: rol === "INQUILINO" ? undefined : null,
    tabBarLabel: "Mi Panel",
  }}
/>
```

---

## Navegación Programática

```typescript
import { useRouter, useLocalSearchParams } from "expo-router";

const router = useRouter();

// Push (apila)
router.push("/(tabs)/(inquilino)/reservas");

// Replace (no apila — usar en login/logout)
router.replace("/(auth)/login");

// Back
router.back();

// Ruta dinámica
router.push(`/(tabs)/(explore)/vivienda/${id}`);

// Params en destino
const { id } = useLocalSearchParams<{ id: string }>();
```

---

## Reglas Críticas de Expo Router v6

1. **Nunca uses `navigation.navigate()`** — usar siempre `router.push()` / `router.replace()`.
2. **Los grupos `(nombre)` no añaden segmento a la URL** — `/app/(tabs)/(inquilino)/reservas.tsx` → ruta: `/reservas`.
3. **`href: null` oculta el tab completamente** — no causa error si el usuario intenta acceder directamente.
4. **Para modales**: crear carpeta `(modal)/` y usar `presentation: "modal"` en el layout.
5. **Deep links**: configurar `scheme: "saferent"` en `app.json` para links externos.

---

## Modal Pattern

```typescript
// app/(modal)/solicitar.tsx
import { Stack } from "expo-router";

export default function SolicitarModal() {
  return (
    <>
      <Stack.Screen options={{ presentation: "modal", title: "Solicitar vivienda" }} />
      {/* contenido */}
    </>
  );
}
```

---

## Redirección Post-Login por Rol

```typescript
// lib/auth.ts — ya implementado
export function rutaSegunRol(rol: Rol): string {
  switch (rol) {
    case "INQUILINO":      return "/(tabs)/(inquilino)";
    case "PROPIETARIO":    return "/(tabs)/(propietario)";
    case "ADMINISTRADOR":  return "/(tabs)/(admin)";
  }
}

// Uso en login screen:
const ruta = rutaSegunRol(usuario.rol);
router.replace(ruta as any);
```

# Skill: Flujo de Alquiler (Rental Flow)

**Activar cuando**: solicitudes, contratos, pagos, reservas, filtro de verificación, flujo inquilino→propietario.

---

## Estados del Flujo

```
INQUILINO crea Solicitud → estado: PENDIENTE
PROPIETARIO acepta/rechaza → estado: ACEPTADA | RECHAZADA
Si ACEPTADA → se genera Contrato (estado: DRAFT → SENT → SIGNED)
Si SIGNED → se generan Pagos mensuales
```

## Tipos Clave

```typescript
// lib/solicitudes.ts
estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA"

// lib/contratos.ts
estado: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED"

// lib/pagos.ts
estado: "PENDIENTE" | "COMPLETADO" | "FALLIDO" | "REEMBOLSADO"
```

## Guard de Perfil Verificado (CRÍTICO)

Siempre verificar `verificado_kyc` antes de crear solicitud:

```typescript
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";

const { usuario } = useAuth();
const router = useRouter();

function handleSolicitarVivienda() {
  if (!usuario?.verificado_kyc) {
    // Redirigir al flujo KYC, NO mostrar error genérico
    router.push("/(tabs)/(inquilino)/verificar-identidad");
    return;
  }
  router.push(`/(tabs)/(inquilino)/solicitar/${viviendaId}`);
}
```

## Crear Solicitud con Documentos

```typescript
// lib/solicitudes.ts — patrón de upload + insert
async function crearSolicitud(input: CrearSolicitudInput) {
  // 1. Subir documento_identidad_url a bucket 'solicitudes-docs'
  // 2. Subir documento_justificativo_url
  // 3. INSERT en solicitudes con ambas URLs
  // Siempre devolver { data, error } — nunca lanzar
}
```

## Contextos Relevantes

- `PropietarioContext` → `solicitudes[]`, `solicitudesPendientes`, `recargar()`
- `InquilinoContext` → `solicitudes[]`, `documentos[]`, `recargar()`

Llamar `recargar()` después de toda mutación (aceptar, rechazar, crear).

## Patrones de UI para Estados

```typescript
// Colores de estado — usar con NativeWind
const estadoConfig = {
  PENDIENTE:  { bg: "bg-amber-100",  text: "text-amber-700",  label: "Pendiente" },
  ACEPTADA:   { bg: "bg-green-100",  text: "text-green-700",  label: "Aceptada" },
  RECHAZADA:  { bg: "bg-red-100",    text: "text-red-700",    label: "Rechazada" },
};
```

## Reglas de Negocio

- Un inquilino no puede tener dos solicitudes PENDIENTES para la misma vivienda.
- Al aceptar una solicitud, automáticamente rechazar las demás de la misma vivienda.
- `motivo_rechazo` es obligatorio al llamar `rechazarSolicitud()`.
- Fechas en formato ISO 8601: `"2026-04-01T00:00:00Z"`.

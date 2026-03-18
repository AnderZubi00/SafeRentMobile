# Skill: Supabase — Queries, RLS y Storage

**Activar cuando**: queries, inserts, updates, RLS, Storage buckets, migraciones, tipos generados.

---

## Cliente y Config

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // CRÍTICO en React Native
    },
  }
);
```

---

## Tablas Principales

| Tabla | Campos clave | Notas |
|---|---|---|
| `usuarios` | `id, email, nombre_completo, rol, verificado_kyc, dni_nie` | id = auth.users.id |
| `viviendas` | `id, titulo, ciudad, barrio, precio_mes, fianza_importe, fotos[], propietario_id, estado` | fotos = array de URLs |
| `solicitudes` | `id, vivienda_id, inquilino_id, propietario_id, estado, documento_identidad_url, documento_justificativo_url` | estado: PENDIENTE\|ACEPTADA\|RECHAZADA |
| `contratos` | `id, solicitud_id, estado, pdf_url, signaturit_id` | estado: DRAFT\|SENT\|SIGNED\|CANCELLED |
| `pagos` | `id, contrato_id, importe, estado, fecha_vencimiento, fecha_pago` | estado: PENDIENTE\|COMPLETADO\|FALLIDO |

---

## Patrón de Query Estándar

```typescript
// Siempre devolver { data, error } — nunca lanzar excepciones
export async function obtenerViviendas(filtros?: FiltrosVivienda): Promise<{
  data: Vivienda[];
  error: string | null;
}> {
  let query = supabase
    .from("viviendas")
    .select("*")
    .eq("estado", "DISPONIBLE")
    .order("fecha_creacion", { ascending: false });

  if (filtros?.ciudad) query = query.ilike("ciudad", `%${filtros.ciudad}%`);
  if (filtros?.precioMax) query = query.lte("precio_mes", filtros.precioMax);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data as Vivienda[]) ?? [], error: null };
}
```

## Query con Join

```typescript
// Seleccionar relaciones — usar alias FK explícito cuando hay múltiples FK a la misma tabla
const { data } = await supabase
  .from("solicitudes")
  .select(`
    *,
    viviendas(id, titulo, ciudad, precio_mes, fotos),
    usuarios!solicitudes_inquilino_id_fkey(id, nombre_completo, email, dni_nie)
  `)
  .eq("propietario_id", userId);
```

---

## Storage — Buckets

| Bucket | Acceso | Uso |
|---|---|---|
| `viviendas-fotos` | Público | Fotos de propiedades |
| `kyc-docs` | Privado (signed URLs) | DNI/NIE, selfies KYC |
| `solicitudes-docs` | Privado | Documentos de solicitud |
| `contratos-pdf` | Privado | PDFs de contratos |

### Upload Correcto en React Native

```typescript
// Obtener blob desde URI local
const response = await fetch(uri);
const blob = await response.blob();

const { error } = await supabase.storage
  .from("viviendas-fotos")
  .upload(`${userId}/${Date.now()}.jpg`, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

// URL pública (solo buckets públicos)
const { data: { publicUrl } } = supabase.storage
  .from("viviendas-fotos")
  .getPublicUrl(path);

// URL firmada (buckets privados) — expira en segundos
const { data } = await supabase.storage
  .from("kyc-docs")
  .createSignedUrl(path, 3600);
```

---

## RLS Policies Esperadas

```sql
-- usuarios: solo pueden ver/editar su propio perfil
-- viviendas: lectura pública, escritura solo propietario
-- solicitudes: inquilino ve las suyas, propietario ve las de sus viviendas
-- contratos: solo partes involucradas (inquilino_id o propietario_id)
-- pagos: solo el usuario involucrado
-- kyc-docs bucket: solo el propietario del archivo (path incluye user.id)
```

---

## Generación de Tipos TypeScript

```bash
# Regenerar tipos cuando cambia el schema
npx supabase gen types typescript --project-id ejymdffnxtgmyjwysflz > types/supabase.ts
```

---

## Errores Frecuentes

| Error | Causa | Solución |
|---|---|---|
| `PGRST116: 0 rows` | `.single()` sin resultados | Usar `.maybeSingle()` o manejar null |
| `new row violates RLS` | Política restrictiva | Verificar auth.uid() en la policy |
| `Storage: Bucket not found` | Bucket no creado | Crear desde Supabase Dashboard |
| `JWT expired` | Token caducado | `autoRefreshToken: true` lo maneja automáticamente |

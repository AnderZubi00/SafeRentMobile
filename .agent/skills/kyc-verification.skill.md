# Skill: Verificación KYC e Imágenes de Cámara

**Activar cuando**: KYC, verificación de identidad, cámara, DNI/NIE, upload de documentos, `verificado_kyc`.

---

## Dependencias Necesarias

```bash
# Ya instaladas en el proyecto:
expo-image-picker   # Acceso a cámara y galería
expo-document-picker # Documentos PDF
```

Plugins requeridos en `app.json` (ya configurados):
```json
"expo-image-picker": {
  "cameraPermission": "SafeRent necesita acceso a tu cámara para verificar tu identidad"
}
```

---

## Patrón Canónico: Captura de Imagen para KYC

```typescript
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

// IMPORTANTE: NO usar base64 para subida. Usar blob/arraybuffer.
// IMPORTANTE: Siempre pedir permisos ANTES de abrir la cámara.
// IMPORTANTE: mediaTypes debe ser ImagePicker.MediaTypeOptions.Images (no string).

async function capturarDocumentoKYC(
  tipo: "frontal" | "trasera" | "selfie"
): Promise<{ url: string | null; error: string | null }> {
  // 1. Pedir permisos
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    return { url: null, error: "Se necesita permiso de cámara para verificar tu identidad" };
  }

  // 2. Abrir cámara
  const resultado = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: tipo === "selfie" ? [1, 1] : [4, 3],
    quality: 0.8, // No usar 1.0 — archivos muy grandes fallan en upload
  });

  if (resultado.canceled) return { url: null, error: null };

  const asset = resultado.assets[0];

  // 3. Convertir URI a Blob — PATRÓN CRÍTICO para React Native
  // NO usar fetch(uri).then(r => r.blob()) directamente en Android — puede fallar
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  // 4. Nombre de archivo único
  const extension = asset.uri.split(".").pop() ?? "jpg";
  const fileName = `kyc/${Date.now()}_${tipo}.${extension}`;

  // 5. Upload a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("kyc-docs") // bucket privado, RLS restrictiva
    .upload(fileName, blob, {
      contentType: asset.mimeType ?? "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return { url: null, error: "Error al subir el documento. Inténtalo de nuevo." };
  }

  // 6. Obtener URL firmada (privada, expira en 1h)
  const { data: signedUrl } = await supabase.storage
    .from("kyc-docs")
    .createSignedUrl(fileName, 3600);

  return { url: signedUrl?.signedUrl ?? null, error: null };
}
```

---

## Errores Comunes y Soluciones

| Error | Causa | Solución |
|---|---|---|
| `Upload failed: 413` | Imagen > 5MB | Reducir `quality` a 0.6 o limitar `aspect` |
| `Permission denied` | Permisos no solicitados | Llamar `requestCameraPermissionsAsync()` antes |
| `Invalid mime type` | `mimeType` undefined | Usar fallback `"image/jpeg"` |
| `Blob conversion failed` en Android | URI de archivo local | Usar `FileSystem.readAsStringAsync` con encoding Base64 como fallback |
| `Storage RLS violation` | Usuario no autenticado | Verificar sesión activa antes del upload |

### Fallback para Android (URI problemáticas)

```typescript
import * as FileSystem from "expo-file-system";

// Si fetch(uri).blob() falla en Android:
const base64 = await FileSystem.readAsStringAsync(asset.uri, {
  encoding: FileSystem.EncodingType.Base64,
});
const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
// Usar byteArray en lugar de blob para el upload
```

---

## Flujo de Verificación KYC Completo

```
1. Capturar frontal DNI/NIE  → subir → guardar URL
2. Capturar trasera DNI/NIE  → subir → guardar URL
3. Capturar selfie            → subir → guardar URL
4. INSERT en tabla kyc_verificaciones { usuario_id, doc_frontal, doc_trasera, selfie, estado: 'PENDIENTE' }
5. ADMIN revisa y actualiza usuarios.verificado_kyc = true
```

## Update de Estado KYC (Admin)

```typescript
await supabase
  .from("usuarios")
  .update({ verificado_kyc: true })
  .eq("id", usuarioId);
// Esto desbloquea el acceso al flujo de solicitudes
```

---

## UX Recomendada

- Mostrar overlay de guía antes de abrir la cámara (encuadre del documento).
- Mostrar preview de la imagen capturada con opción de repetir.
- Indicador de progreso durante el upload.
- Estado de verificación visible en el perfil del inquilino con badge "Verificado ✓".

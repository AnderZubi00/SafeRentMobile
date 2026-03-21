# Skill: Verificación KYC e Imágenes de Cámara

**Activar cuando**: KYC, verificación de identidad, cámara, DNI/NIE, upload de documentos, `verificado_kyc`, `kyc_sesiones`, `kyc_verificaciones`.

**NFC**: Para lectura del chip NFC, cargar también `nfc-passport.skill.md`.

---

## Dependencias Necesarias

```bash
# Ya instaladas en el proyecto:
expo-camera          # Captura de fotos (CameraView) — reemplazó expo-image-picker para KYC
react-native-nfc-manager  # Lectura chip NFC
```

Plugins requeridos en `app.json` (ya configurados):
```json
"expo-camera": {
  "cameraPermission": "SafeRent necesita acceso a tu cámara para verificar tu identidad"
}
```

> **Nota deprecación**: `ImagePicker.MediaTypeOptions.Images` está deprecado en Expo 54+.
> Usar la nueva API: `mediaTypes: ["images"]` (array de strings).
> En el flujo KYC actual se usa `expo-camera` con `CameraView` directamente — no `expo-image-picker`.

---

## Flujo Completo de Verificación KYC

```
1. Web crea kyc_sesiones { token, expira_en, estado: "PENDIENTE" } → genera QR
2. Mobile escanea QR → recibe token + sesionId via deep link
   └─ Fallback Expo Go: input manual de token y sesionId
3. Mobile valida sesión en Supabase → actualiza estado a "ESCANEANDO"
4. Wizard de pasos: camera_front → camera_back → nfc_position → nfc_reading → success

   PASO 1 — camera_front:
     - Capturar anverso DNI con CameraView.takePictureAsync({ quality: 0.85 })
     - Guardar URI en state (frenteUri) — NO subir todavía
     - Avanzar a camera_back

   PASO 2 — camera_back:
     - Capturar reverso DNI (enfocando la zona MRZ)
     - Capturar ANTES de cambiar estado (setEstado("analyzing") desmonta el CameraView)
     - POST FormData a /api/kyc/analizar?mode=completo con { frente, reverso }
     - OCR con GPT-4o analiza AMBAS caras simultáneamente
     - Response: OcrResult con recomendacion, safe_score, datos_extraidos, mrz_debug, cd_ok
     - Si recomendacion === "RECHAZAR" → marcar kyc_sesiones como FALLIDO → mostrar error
     - Si ok → guardar campos MRZ validados en refs confiables → avanzar a nfc_position

   PASO 3 — nfc_position / nfc_reading (si dispositivo tiene NFC):
     - BAC handshake usando numero_soporte + fecha_nacimiento + fecha_expiracion
     - Éxito NFC → +20 pts al score (capped en 95)
     - Fallo o skip → continuar sin NFC (score capped en 75)

5. kyc_sesiones.update({ estado: "COMPLETADO", safe_score, nfc_verificado, datos_raw })
6. Web recibe resultado via Supabase Realtime subscription en kyc_sesiones
```

### Score final

```typescript
function calcularScoreFinal(ocrScore: number, nfcExitoso: boolean): number {
  const base = Math.min(ocrScore, 75);   // OCR máximo 75 pts
  const bonus = nfcExitoso ? 20 : 0;    // NFC suma 20 pts
  return Math.min(base + bonus, 95);    // Tope global: 95
}
```

---

## Wizard Steps (Estado)

```typescript
type Estado =
  | "idle"          // Sin token/sesión todavía
  | "validating"    // Verificando sesión en Supabase
  | "camera_front"  // Capturando anverso DNI
  | "camera_back"   // Capturando reverso DNI + análisis OCR
  | "analyzing"     // Esperando respuesta GPT-4o
  | "nfc_position"  // Instrucciones de posicionamiento NFC
  | "nfc_reading"   // Leyendo chip (timeout 30s)
  | "nfc_success"   // Chip leído OK (pantalla intermedia 1.5s)
  | "success"       // Verificación completada
  | "error";        // Error recuperable
```

**Transiciones clave**:
- `idle` → `validating` cuando token + sesionId están disponibles (auto en mount)
- `validating` → `camera_front` si sesión válida y permiso de cámara concedido
- `camera_front` → `camera_back` al capturar anverso
- `camera_back` → `analyzing` al capturar reverso (antes de llamar a la API)
- `analyzing` → `nfc_position` si OCR ok y dispositivo tiene NFC
- `analyzing` → `success` si OCR ok pero sin NFC
- `nfc_position` → `nfc_reading` al iniciar lectura
- `nfc_reading` → `nfc_success` → `success` si NFC exitoso
- `nfc_reading` → `nfc_position` si fallo con reintentos restantes (máx 3)
- `nfc_reading` → `success` si agotados 3 intentos (sin NFC)

---

## Patrón Canónico: Captura con CameraView

```typescript
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";

const cameraRef = useRef<CameraView>(null);
const [cameraReady, setCameraReady] = useState(false);
const [permission, requestPermission] = useCameraPermissions();

// Siempre verificar permisos antes de mostrar la cámara
if (!permission?.granted) {
  const { granted } = await requestPermission();
  if (!granted) return; // mostrar error
}

// JSX: fallback de 2s si onCameraReady no dispara (bug conocido en algunos Android)
<CameraView
  ref={cameraRef}
  style={{ flex: 1 }}
  facing="back"
  onCameraReady={() => setCameraReady(true)}
/>

// Capturar foto
const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
// foto.uri — URI local del archivo capturado
```

> **CRÍTICO**: Capturar la foto ANTES de llamar `setEstado("analyzing")`.
> `setEstado` desmonta el componente `CameraView`, lo que invalida `cameraRef`.

---

## Llamada a la API OCR (modo completo)

El flujo actual envía **ambas caras en una sola llamada** usando `mode=completo`:

```typescript
const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

const formData = new FormData();
formData.append("frente", {
  uri: frenteUri,
  type: "image/jpeg",
  name: "frente.jpg",
} as unknown as Blob);
formData.append("reverso", {
  uri: foto.uri,
  type: "image/jpeg",
  name: "reverso.jpg",
} as unknown as Blob);

const respuesta = await fetch(`${WEB_API_URL}/api/kyc/analizar?mode=completo`, {
  method: "POST",
  body: formData,
  // NO establecer Content-Type — fetch lo pone automáticamente con el boundary correcto
});

const ocr = await respuesta.json();
```

### Estructura de respuesta OCR (`mode=completo`)

```typescript
interface OcrResult {
  recomendacion: "APROBAR" | "RECHAZAR" | "REVISAR_MANUAL";
  safe_score: number;           // 0-75 (sin NFC)
  cd_ok: boolean;               // true si DOB y expiry pasaron dígito verificador ICAO 9303
  datos_extraidos: {
    nombre: string;
    apellidos: string;
    numero_documento: string;   // DNI/NIE visual (ej: 49577656Y)
    numero_soporte: string;     // 9 chars alfanuméricos de línea 1 MRZ (ej: CHD193049)
    fecha_nacimiento: string;   // YYMMDD de posiciones 0-5 línea 2 MRZ
    fecha_expiracion: string;   // YYMMDD de posiciones 8-13 línea 2 MRZ
  };
  tipo_documento: "DNI" | "NIE" | "Pasaporte" | "Desconocido";
  mrz_debug: {
    linea1: string;             // 30 chars limpiados de la línea 1 MRZ
    linea2: string;             // 30 chars limpiados de la línea 2 MRZ
    dobValid: boolean;          // true si dígito verificador ICAO 9303 de fecha_nacimiento es correcto
    expiryValid: boolean;       // true si dígito verificador ICAO 9303 de fecha_expiracion es correcto
    dobCd: number;              // dígito verificador esperado para DOB
    expiryCd: number;           // dígito verificador esperado para expiry
    dob: string;                // YYMMDD validado (vacío si dobValid es false)
    expiry: string;             // YYMMDD validado (vacío si expiryValid es false)
    soporteValid: boolean;      // true si dígito verificador de numero_soporte es correcto
  };
}
```

### Lógica de recomendación (calculada por código, no GPT)

| Condición | recomendacion | safe_score |
|---|---|---|
| parseOk=false y sin DNI | RECHAZAR | ≤ 29 |
| Sin número de documento | REVISAR_MANUAL | ≤ 54 |
| DOB y expiry con dígito verificador ok | APROBAR | ≤ 75 |
| DOB o expiry fallido | REVISAR_MANUAL | ≤ 54 |

---

## Patrón Best-Field: Preservar Campos MRZ Validados

Los refs sobreviven entre rescans y se usan como fuente de verdad para el BAC handshake NFC.

```typescript
// Refs — inicializar en el componente
const soporteConfiableRef = useRef<string | null>(null);
const dobConfiableRef = useRef<string | null>(null);
const expiryConfiableRef = useRef<string | null>(null);

// Después de recibir OcrResult:
const mrzDebug = (ocr as unknown as {
  mrz_debug?: {
    soporteValid?: boolean;
    dobValid?: boolean;
    expiryValid?: boolean;
    dob?: string;
    expiry?: string;
  };
}).mrz_debug;

if (ocr.datos_extraidos.numero_soporte && mrzDebug?.soporteValid) {
  soporteConfiableRef.current = ocr.datos_extraidos.numero_soporte;
}
if (mrzDebug?.dobValid && mrzDebug.dob) {
  dobConfiableRef.current = mrzDebug.dob;
}
if (mrzDebug?.expiryValid && mrzDebug.expiry) {
  expiryConfiableRef.current = mrzDebug.expiry;
}

// Al construir los campos MRZ para NFC BAC:
const documentNumber =
  soporteConfiableRef.current ||
  ocr.datos_extraidos.numero_soporte ||
  ocr.datos_extraidos.numero_documento ||
  "";
const dateOfBirth = dobConfiableRef.current || ocr.datos_extraidos.fecha_nacimiento;
const dateOfExpiry = expiryConfiableRef.current || ocr.datos_extraidos.fecha_expiracion;
```

> **Por qué**: Si el usuario vuelve a escanear el reverso (error SW=6300 del NFC), un nuevo OCR puede leer peor que el anterior. Los refs garantizan que el mejor valor conocido siempre prevalece.

---

## Lógica NFC

Ver `nfc-passport.skill.md` para el BAC handshake completo.

Puntos clave para integración:

```typescript
// Verificar soporte en mount (una sola vez)
const supported = await NfcManager.isSupported();
if (supported) {
  try { await NfcManager.start(); } catch { /* ya iniciado */ }
}

// Timeout de 30s con cancelTechnologyRequest
const timeout = new Promise<NfcPassportResult>((resolve) => {
  const id = setTimeout(async () => {
    try { await NfcManager.cancelTechnologyRequest(); } catch { /* ignorar */ }
    await new Promise((r) => setTimeout(r, 300)); // pequeña pausa post-cancel
    resolve({ success: false, error: "Tiempo agotado", intentos: nfcRetriesRef.current });
  }, 30_000);
  nfcTimeoutRef.current = id;
});

const result = await Promise.race([verifyPassportNfc({ documentNumber, dateOfBirth, dateOfExpiry }), timeout]);
```

**Comportamiento ante `redirectTo === "mrz_scan"`** (error SW=6300):
- Primera vez: volver a `camera_back` para rescanear MRZ
- Segunda vez (mismo error): mostrar error y permitir skip

**Regla crítica**: NO llamar `cancelTechnologyRequest` en el unmount del componente.
Solo el handler del timeout o el flujo explícito de skip deben cancelar. Llamarlo sin sesión activa corrompe el estado nativo de Android.

**Máximo 3 intentos NFC**. Al tercer fallo → completar sin NFC.

---

## Completar Sesión en Supabase

```typescript
await supabase
  .from("kyc_sesiones")
  .update({
    estado: "COMPLETADO",
    safe_score: finalScore,
    nfc_verificado: nfcExitoso,
    nombre_extraido: ocr.datos_extraidos.nombre,
    apellidos_extraidos: ocr.datos_extraidos.apellidos,
    dni_extraido: ocr.datos_extraidos.numero_documento,
    tipo_documento: ocr.tipo_documento,
    datos_raw: {
      ocr,
      nfc_resultado: {
        exitoso: nfcExitoso,
        intentos: nfcIntentos,
        ...(nfcExitoso ? {} : { razon: mensajeError }),
      },
    },
  })
  .eq("id", sesionId);
```

La web recibe el resultado vía **Supabase Realtime** subscription sobre `kyc_sesiones`.

---

## Flujo QR Web ↔ Mobile

```
Web                                    Mobile
────────────────────────────────────────────────────────
INSERT kyc_sesiones
  { token, expira_en, estado: PENDIENTE }
  → genera QR con token + sesionId

                                       Escanea QR → deep link
                                       expo://kyc-movil?token=X&sesion=Y

                                       SELECT kyc_sesiones WHERE token = X
                                       Verifica expiración y estado
                                       UPDATE estado → ESCANEANDO

                                       ... captura + OCR + NFC ...

                                       UPDATE kyc_sesiones
                                         estado = COMPLETADO
                                         safe_score, nfc_verificado, datos_raw

Realtime subscription dispara ←────────────────────────
Web recibe resultado y avanza
```

---

## Errores Comunes y Soluciones

| Error | Causa | Solución |
|---|---|---|
| `Upload failed: 413` | Imagen > 5MB | Reducir `quality` a 0.6 |
| `Permission denied` | Permisos no solicitados | Llamar `requestPermission()` de `useCameraPermissions` |
| `Invalid mime type` | `mimeType` undefined | Usar fallback `"image/jpeg"` |
| `Blob conversion failed` en Android | URI de archivo local | Ver fallback FileSystem más abajo |
| `Storage RLS violation` | Usuario no autenticado | Verificar sesión activa antes del upload |
| `CameraView ref null al takePictureAsync` | Estado cambió antes de capturar | Capturar SIEMPRE antes de `setEstado` |
| NFC corrompe estado nativo | `cancelTechnologyRequest` sin sesión activa | Solo cancelar desde timeout handler o skip explícito |
| SW=6300 en BAC | `numero_soporte` incorrecto | Volver a escanear MRZ; usar `soporteConfiableRef` |
| `onCameraReady` no dispara | Bug en algunos Android | Fallback: `setTimeout(() => setCameraReady(true), 2000)` |

### Fallback Android para URI problemáticas (Supabase Storage directo)

```typescript
import * as FileSystem from "expo-file-system";

// Si fetch(uri).blob() falla en Android:
const base64 = await FileSystem.readAsStringAsync(asset.uri, {
  encoding: FileSystem.EncodingType.Base64,
});
const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
// Usar byteArray en lugar de blob para supabase.storage.upload(...)
```

---

## Patrón Canónico: Upload a Supabase Storage (si se necesita URL firmada)

En el flujo actual (`mode=completo`) las imágenes se envían como FormData directamente a la API y no se suben al Storage. Este patrón aplica si en el futuro se necesita guardar las imágenes en Storage:

```typescript
import { supabase } from "@/lib/supabase";

// Convertir URI a Blob
const response = await fetch(asset.uri);
const blob = await response.blob();

const extension = asset.uri.split(".").pop() ?? "jpg";
const fileName = `kyc/${Date.now()}_${tipo}.${extension}`;

const { error: uploadError } = await supabase.storage
  .from("kyc-docs") // bucket privado, RLS restrictiva
  .upload(fileName, blob, {
    contentType: asset.mimeType ?? "image/jpeg",
    upsert: false,
  });

// URL firmada (privada, expira en 1h)
const { data: signedUrl } = await supabase.storage
  .from("kyc-docs")
  .createSignedUrl(fileName, 3600);
```

---

## UX Recomendada

- **camera_front**: Overlay con guía de encuadre (rectángulo punteado 300×190). Hint de iluminación.
- **camera_back**: Guía específica para zona MRZ (3 líneas de texto monospace como referencia visual). Botón deshabilitado hasta `cameraReady = true`.
- **analyzing**: Spinner con texto "GPT-4o verifica ambas caras del DNI".
- **nfc_position**: Diagrama visual DNI vs. teléfono. Mensaje de error del intento anterior si aplica. Contador "Intento X de 3". Botón de skip siempre visible.
- **nfc_reading**: Spinner + "No retires el DNI". Botón de skip.
- **success**: Score final prominente. Badge "Chip NFC verificado" si aplica. Instrucción de volver al ordenador.
- **error**: Mensaje específico. Botón "Intentar de nuevo" que vuelve a `camera_front`.

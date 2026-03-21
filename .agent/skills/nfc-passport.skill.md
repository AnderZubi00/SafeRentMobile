---
name: nfc-passport
description: >
  NFC BAC (Basic Access Control) handshake for reading Spanish DNI chip (ICAO 9303)
  on Android/iOS using react-native-nfc-manager v4.0.0-beta.7.
  Trigger: When task involves NFC, chip reading, ICAO, BAC, MRZ keys, kMRZ, ePassport, DNI chip, pasaporte electrónico.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Reading Spanish DNI chip (TD1 format) via NFC
- Implementing or modifying BAC handshake (Basic Access Control)
- Deriving kMRZ keys from OCR-scanned MRZ fields
- Handling `react-native-nfc-manager` v4 session lifecycle
- Integrating NFC result into KYC verification flow

---

## Critical Patterns

### 1. kMRZ Construction — Spanish DNI TD1

Format: `docNumber(9 chars) + CD + DOB(YYMMDD) + CD + expiry(YYMMDD) + CD` = **24 chars total**

```typescript
// CRITICAL: Spanish DNI uses `numero_soporte` (NOT `numero_documento`)
// Source: MRZ Line 1, positions 5-13 (0-indexed), CD at position 14
const docField = soporte.padEnd(9, '<');          // right-pad with '<' to 9 chars
const cd1 = computeCheckDigit(docField);
const dobField = dob;                              // YYMMDD
const cd2 = computeCheckDigit(dobField);
const expiryField = expiry;                        // YYMMDD
const cd3 = computeCheckDigit(expiryField);
const kMRZ = docField + cd1 + dobField + cd2 + expiryField + cd3; // 24 chars
```

### 2. ICAO 9303 Check Digit Algorithm

```typescript
function computeCheckDigit(value: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    let v = 0;
    if (c >= '0' && c <= '9') v = parseInt(c);
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    else v = 0; // '<' and anything else = 0
    sum += v * weights[i % 3];
  }
  return String(sum % 10);
}
```

### 3. BAC Key Derivation (ICAO 9303 Part 11)

```typescript
// kseed = first 16 bytes of SHA-1(kMRZ as UTF-8)
const kseed = sha1(Buffer.from(kMRZ, 'utf8')).slice(0, 16);

// Ka = 3DES encryption key (c = 0x00000001)
const Ka = adjustParity(sha1(Buffer.concat([kseed, Buffer.from([0,0,0,1])])).slice(0, 16));

// Kb = 3DES MAC key (c = 0x00000002)
const Kb = adjustParity(sha1(Buffer.concat([kseed, Buffer.from([0,0,0,2])])).slice(0, 16));

function adjustParity(key: Buffer): Buffer {
  return Buffer.from(key.map(b => {
    let byte = b & 0xFE;
    let parity = 0;
    for (let i = 1; i < 8; i++) parity ^= (byte >> i) & 1;
    return byte | parity;
  }));
}
```

### 4. BAC Handshake Sequence

```
SELECT AID (a0 00 00 02 47 10 01)
  ↓
GET CHALLENGE → rndIcc (8 bytes)
  ↓
Build S = rndIfd(8) || rndIcc(8) || kIfd(16)
eIfd = 3DES-CBC-encrypt(Ka, IV=0x00×8, S)
mIfd = RetailMAC(Kb, eIfd)      ← ISO 9797-1 Algorithm 3
  ↓
MUTUAL AUTHENTICATE [eIfd || mIfd] (40 bytes)
  ↓
Verify: MAC valid + rndIfd echo at positions 8-16 of decrypted response
```

RetailMAC (ISO 9797-1 Alg 3) = DES-CBC(first 8 bytes of key, data) → last block → 3DES(full key, last block)

### 5. react-native-nfc-manager v4 Session Lifecycle — CRITICAL

```typescript
let technologyRequested = false;

try {
  // STEP 1: Preventive cancel — cleans up any stale session (idempotent)
  try { await NfcManager.cancelTechnologyRequest(); } catch {}
  await new Promise(r => setTimeout(r, 150));

  // STEP 2: registerTagEvent BEFORE requestTechnology
  await NfcManager.registerTagEvent({ alertMessage: "Acercá el DNI al teléfono..." });

  // STEP 3: requestTechnology — alertMessage REQUIRED on Android (silent fail without it)
  await NfcManager.requestTechnology([NfcTech.IsoDep], { alertMessage: "Mantené el DNI quieto..." });
  technologyRequested = true; // ← set ONLY after success

  // ... perform BAC handshake ...

} catch (err) {
  // ...
} finally {
  // ONLY cancel if session was actually started — calling cancel with no session
  // corrupts Android NFC state machine → cascade of {} errors
  if (technologyRequested) {
    try { await NfcManager.cancelTechnologyRequest(); } catch {}
  }
}
```

**Rules:**
- `alertMessage` is REQUIRED in BOTH `registerTagEvent` and `requestTechnology` on Android — omitting it causes silent failure with `{}`
- Set `technologyRequested = true` ONLY after `requestTechnology` succeeds
- Never call `cancelTechnologyRequest()` in catch/finally unless `technologyRequested === true`
- The 150ms delay after preventive cancel is mandatory for Android state machine recovery

### 6. OCR Field Validation + Best-Field Preservation

GPT-4o OCR is inconsistent — each scan may return different fields incorrectly. Preserve the best valid value across rescans:

```typescript
// Refs survive re-renders and re-scans
const soporteConfiableRef = useRef<string | null>(null);
const dobConfiableRef     = useRef<string | null>(null);
const expiryConfiableRef  = useRef<string | null>(null);

// After each OCR scan, only overwrite if new value passes CD validation
if (mrz_debug.soporteValid && newSoporte) soporteConfiableRef.current = newSoporte;
if (mrz_debug.dobValid     && newDob)     dobConfiableRef.current     = newDob;
if (mrz_debug.expiryValid  && newExpiry)  expiryConfiableRef.current  = newExpiry;

// Use best available values to build kMRZ
const soporte = soporteConfiableRef.current ?? ocrResult.soporte;
```

Server validates soporte from MRZ line 1 with CD (`mrz_debug.soporteValid`).

### 7. Error Handling Table

| Error | Cause | User message |
|-------|-------|--------------|
| `{}` / empty message | `cancelTechnologyRequest` called with no active session | "No se pudo iniciar la lectura NFC" |
| `SW=6300` | Wrong BAC keys — MRZ data incorrect | "Los datos del reverso no coinciden con el chip" → redirect to `mrz_scan` |
| `SW=6982` | Chip authentication failure | "El chip no respondió a la autenticación" |
| `transceive fail` | Tag lost mid-read | "El DNI perdió contacto durante la lectura" |
| `UserCancel` / `cancelled` | User cancelled or timeout | "Lectura cancelada" |
| `type: UserCancel, msg: ""` | `requestTechnology` waiting — NFC dialog never shown | Investigate `alertMessage` presence |

### 8. iOS vs Android Differences

| Feature | Android | iOS |
|---------|---------|-----|
| NFC check | `await NfcManager.isEnabled()` | Wrap in try/catch — throws on iOS |
| Tag tech class | `android.nfc.tech.IsoDep` (full class name) | `IsoDep` |
| System NFC dialog | None — instruct user verbally | System dialog shown automatically |
| Required entitlement | `android.permission.NFC` in AndroidManifest | `com.apple.developer.nfc.readersession.iso7816.select-identifiers` in `app.json` |

```typescript
// Safe NFC enabled check for both platforms
let nfcEnabled = true;
try { nfcEnabled = await NfcManager.isEnabled(); } catch {}
if (!nfcEnabled) { /* show settings prompt */ }
```

### 9. KYC Integration

- NFC success adds **+20 points** to verification score
- Result flows into `kyc_verificaciones` table via `/api/kyc/analizar`
- DB field: `nfc_verificado: boolean`
- Trigger: after OCR scan of DNI back (`camera_back` step), user taps "Leer chip"
- If BAC fails with `SW=6300` → redirect user back to `mrz_scan` step

---

## Files

| File | Role |
|------|------|
| `SafeRentMobile/lib/nfc-passport.ts` | NFC BAC orchestration — entry point |
| `SafeRentMobile/lib/bac.ts` | BAC crypto: kMRZ, check digits, 3DES, Retail MAC |
| `SafeRentMobile/app/kyc-movil.tsx` | KYC flow that consumes NFC result |
| `SafeRent/src/app/api/kyc/analizar/route.ts` | OCR server — validates MRZ fields, sets `mrz_debug` |

---

## Commands

```bash
# Install NFC manager (exact version — do NOT upgrade, v4 API differs from v3)
npx expo install react-native-nfc-manager@4.0.0-beta.7

# Rebuild native after installing
npx expo prebuild --clean
npx expo run:android
```

---

## Resources

- **Standard**: ICAO Doc 9303 Part 11 — Machine Readable Travel Documents (BAC protocol)
- **Library**: `react-native-nfc-manager` v4 — check `node_modules/react-native-nfc-manager/src/` for TypeScript types

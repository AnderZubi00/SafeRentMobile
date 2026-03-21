/**
 * NFC ePassport reader — ICAO 9303
 * Performs BAC (Basic Access Control) handshake against Spanish DNI chip
 */
import NfcManager, { NfcTech } from "react-native-nfc-manager";
import {
  buildKmrz,
  deriveBacKeys,
  buildMutualAuthData,
  verifyMutualAuthResponse,
  randomBytes,
  type MrzFields,
} from "./bac";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NfcPassportResult {
  success: boolean;
  error?: string;
  intentos: number;
  redirectTo?: "mrz_scan";
}

// ---------------------------------------------------------------------------
// AID — standard ePassport (Spanish DNI included)
// ---------------------------------------------------------------------------

const AID_EPASSPORT = [0xa0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01];

// ---------------------------------------------------------------------------
// APDU transceive helper — throws if SW !== 90 00
// ---------------------------------------------------------------------------

async function transceive(cmd: number[]): Promise<number[]> {
  const response: number[] = await NfcManager.isoDepHandler.transceive(cmd);
  if (response.length < 2) throw new Error("Response too short");
  const sw1 = response[response.length - 2];
  const sw2 = response[response.length - 1];
  if (sw1 !== 0x90 || sw2 !== 0x00) {
    throw new Error(
      `APDU error: SW=${sw1.toString(16).padStart(2, "0")}${sw2.toString(16).padStart(2, "0")}`
    );
  }
  return response.slice(0, -2); // strip SW
}

// ---------------------------------------------------------------------------
// APDU commands
// ---------------------------------------------------------------------------

async function selectAid(): Promise<void> {
  await transceive([
    0x00, 0xa4, 0x04, 0x0c,
    AID_EPASSPORT.length,
    ...AID_EPASSPORT,
  ]);
}

async function getChallenge(): Promise<number[]> {
  // GET CHALLENGE — returns 8 random bytes from chip
  const response = await transceive([0x00, 0x84, 0x00, 0x00, 0x08]);
  if (response.length !== 8) throw new Error("Invalid GET CHALLENGE response length");
  return response;
}

async function mutualAuthenticate(cmdData: number[]): Promise<number[]> {
  // MUTUAL AUTHENTICATE — 40-byte input, 40-byte output
  const cmd = [0x00, 0x82, 0x00, 0x00, 0x28, ...cmdData, 0x28];
  const response = await transceive(cmd);
  if (response.length !== 40) throw new Error("Invalid MUTUAL AUTHENTICATE response length");
  return response;
}

// ---------------------------------------------------------------------------
// Main: verify passport NFC via BAC handshake
// ---------------------------------------------------------------------------

export async function verifyPassportNfc(
  fields: MrzFields,
): Promise<NfcPassportResult> {
  // Check NFC hardware
  const supported = await NfcManager.isSupported();
  console.log("[NFC] isSupported:", supported);
  if (!supported) {
    return { success: false, error: "NFC no disponible en este dispositivo", intentos: 0 };
  }

  // Check NFC enabled (v4 API)
  try {
    const enabled = await (NfcManager as unknown as { isEnabled?: () => Promise<boolean> }).isEnabled?.();
    console.log("[NFC] isEnabled:", enabled);
    if (enabled === false) {
      return { success: false, error: "NFC está desactivado — activalo en Ajustes del teléfono", intentos: 0 };
    }
  } catch { /* isEnabled not available on iOS */ }

  let technologyRequested = false;
  try {
    // Limpiar sesión obsoleta del intento anterior (idempotente con try/catch)
    try {
      console.log("[NFC] Preventive cancel...");
      await NfcManager.cancelTechnologyRequest();
      console.log("[NFC] Preventive cancel OK");
    } catch (cancelErr) {
      console.log("[NFC] Preventive cancel threw (ok):", JSON.stringify(cancelErr));
    }
    await new Promise((r) => setTimeout(r, 150));

    // Verificar estado del foreground dispatch
    try {
      const hasReg = await (NfcManager as any)._hasTagEventRegistrationAndroid?.();
      console.log("[NFC] hasTagEventRegistration:", hasReg);
    } catch { /* only on Android debug builds */ }

    console.log("[NFC] Llamando registerTagEvent...");
    try {
      await NfcManager.registerTagEvent({ alertMessage: "Acercá el reverso del DNI a la parte trasera del teléfono" });
      console.log("[NFC] registerTagEvent OK");
    } catch (regErr) {
      console.warn("[NFC] registerTagEvent threw:", JSON.stringify(regErr), typeof regErr);
    }

    console.log("[NFC] Llamando requestTechnology...");
    // alertMessage es OBLIGATORIO en Android — sin él el native falla silenciosamente con {}
    await NfcManager.requestTechnology([NfcTech.IsoDep], {
      alertMessage: "Acercá el reverso del DNI a la parte trasera del teléfono",
    });
    technologyRequested = true;
    console.log("[NFC] requestTechnology OK");

    // Dar tiempo al chip para estabilizarse antes del primer APDU
    await new Promise((r) => setTimeout(r, 200));

    const tag = await NfcManager.getTag();
    console.log("[NFC] getTag result:", JSON.stringify(tag));
    if (!tag) throw new Error("No se detectó ningún chip NFC");
    const techList: string[] = (tag as { techTypes?: string[] }).techTypes ?? [];
    if (!techList.includes("android.nfc.tech.IsoDep")) {
      throw new Error("El documento no tiene chip IsoDep compatible");
    }
    console.log("[NFC] Chip detectado");

    // 1. SELECT ePassport AID
    console.log("[NFC] SELECT AID...");
    await selectAid();
    console.log("[NFC] AID OK");

    // 2. GET CHALLENGE → rndIcc (8 bytes from chip)
    console.log("[NFC] GET CHALLENGE...");
    const rndIcc = await getChallenge();
    console.log("[NFC] rndIcc:", rndIcc);

    // 3. Derive BAC keys from MRZ data
    const kmrz = buildKmrz(fields);
    console.log("[NFC] kmrz:", kmrz, "(length:", kmrz.length, ")");
    const keys = await deriveBacKeys(kmrz);

    // 4. Build our random bytes
    const rndIfd = randomBytes(8);
    const kIfd = randomBytes(16);

    // 5. Build and send MUTUAL AUTHENTICATE
    console.log("[NFC] MUTUAL AUTHENTICATE...");
    const cmdData = buildMutualAuthData(rndIfd, rndIcc, kIfd, keys);
    const response = await mutualAuthenticate(cmdData);
    console.log("[NFC] MUTUAL AUTH OK, verificando MAC...");

    // 6. Verify chip's response MAC + rndIfd echo
    const verified = verifyMutualAuthResponse(response, rndIfd, keys);
    console.log("[NFC] MAC verificado:", verified);

    await NfcManager.cancelTechnologyRequest();

    if (!verified) {
      return { success: false, error: "Verificación MAC fallida — datos MRZ incorrectos", intentos: 1, redirectTo: "mrz_scan" };
    }
    return { success: true, intentos: 1 };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[NFC] Error raw:", JSON.stringify(err), "| msg:", msg, "| type:", err?.constructor?.name, "| isError:", err instanceof Error);
    // Solo cancelar si requestTechnology fue exitoso — si falló con {}, no hay sesión activa
    // y llamar cancel corrompería el state machine nativo de Android (cascada infinita de {})
    if (technologyRequested) {
      try { await NfcManager.cancelTechnologyRequest(); } catch { /* ignore */ }
    }
    const isMrzMismatch = msg.includes("6300");
    return {
      success: false,
      error: traducirErrorNfc(msg),
      intentos: 1,
      ...(isMrzMismatch && { redirectTo: "mrz_scan" as const }),
    };
  }
}

// ---------------------------------------------------------------------------
// User-friendly error messages
// ---------------------------------------------------------------------------

function traducirErrorNfc(technical: string): string {
  if (!technical || technical === "{}") {
    return "No se pudo iniciar la lectura NFC — acercá el DNI al teléfono y volvé a intentar";
  }
  if (technical.includes("cancelled") || technical.includes("Cancelled")) {
    return "Lectura cancelada";
  }
  if (technical.includes("timeout") || technical.includes("Timeout")) {
    return "Tiempo de espera agotado — mantené el DNI quieto junto al teléfono";
  }
  if (technical.includes("SW=6300") || technical.includes("6300")) {
    return "Los datos del reverso no coinciden con el chip — volvé a escanear el reverso del DNI";
  }
  if (technical.includes("SW=6900") || technical.includes("6982")) {
    return "El chip no respondió a la autenticación — intentá de nuevo";
  }
  if (technical.includes("transceive fail") || technical.includes("transceive")) {
    return "El DNI perdió contacto durante la lectura — pegalo firme contra la parte trasera del teléfono y no lo muevas";
  }
  if (technical.includes("APDU error")) {
    return "Error de comunicación con el chip del DNI";
  }
  return "No se pudo leer el chip — verificá la posición del DNI";
}

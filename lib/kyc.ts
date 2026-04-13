import { api } from "./api";

export type EstadoKyc =
  | "PENDIENTE"
  | "ESCANEANDO"
  | "COMPLETADO"
  | "FALLIDO";

export interface KycSesion {
  id: string;
  token: string;
  expira_en: string;
}

export interface EstadoKycResponse {
  verificado_kyc: boolean;
  ultima_sesion?: {
    estado: EstadoKyc;
    safe_score?: number;
    nfc_verificado?: boolean;
    nombre_extraido?: string;
    apellidos_extraidos?: string;
    dni_extraido?: string;
    tipo_documento?: string;
  } | null;
}

export interface CompletarKycInput {
  nombre: string;
  apellidos: string;
  dni_nie: string;
  tipo_documento: string;
}

export interface DatosExtraidosOCR {
  nombre?: string;
  apellidos?: string;
  numero_documento?: string;
  numero_soporte?: string;
  fecha_nacimiento?: string;
  fecha_expiracion?: string;
  tipo_documento?: string;
}

export interface AnalisisOCRResponse {
  recomendacion: "APROBAR" | "RECHAZAR" | "REVISAR_MANUAL";
  safe_score: number;
  datos_extraidos: DatosExtraidosOCR;
  tipo_documento?: string;
  mrz_debug?: unknown;
  cd_ok?: boolean;
}

// ---------------------------------------------------------------------------
// KYC autenticado (flujo web-style: usuario autenticado escanea localmente)
// ---------------------------------------------------------------------------

/** Crea o recupera una sesión KYC activa (genera token + QR si la web lo pide) */
export async function crearSesionKyc(): Promise<{
  data: KycSesion | null;
  error: string | null;
}> {
  try {
    const data = await api.post<KycSesion>("/kyc/sesion");
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Consulta el estado actual de KYC del usuario autenticado */
export async function obtenerEstadoKyc(): Promise<{
  data: EstadoKycResponse | null;
  error: string | null;
}> {
  try {
    const data = await api.get<EstadoKycResponse>("/kyc/estado");
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Completa KYC de propietario con datos manuales (sin OCR) */
export async function completarKycPropietario(
  input: CompletarKycInput
): Promise<{ error: string | null }> {
  try {
    await api.patch("/kyc/completar-propietario", input);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

/** Análisis OCR single-image (autenticado) */
export async function analizarDocumento(
  imagenBase64: string
): Promise<{ data: AnalisisOCRResponse | null; error: string | null }> {
  try {
    const data = await api.post<AnalisisOCRResponse>("/kyc/analizar", {
      imagen_base64: imagenBase64,
    });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Análisis OCR frente + reverso (autenticado) */
export async function analizarDocumentoCompleto(
  frenteBase64: string,
  reversoBase64: string
): Promise<{ data: AnalisisOCRResponse | null; error: string | null }> {
  try {
    const data = await api.post<AnalisisOCRResponse>("/kyc/analizar/completo", {
      frente_base64: frenteBase64,
      reverso_base64: reversoBase64,
    });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

// ---------------------------------------------------------------------------
// KYC móvil sin JWT (token de sesión generado por web via QR)
// ---------------------------------------------------------------------------

export interface ValidarSesionMovilResponse {
  valid: boolean;
  estado?: EstadoKyc;
  sesionId?: string;
  reason?: string;
}

export async function validarSesionKycMovil(token: string): Promise<{
  data: ValidarSesionMovilResponse | null;
  error: string | null;
}> {
  try {
    const data = await api.post<ValidarSesionMovilResponse>(
      "/kyc/mobile/validate",
      { token }
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Análisis OCR frente + reverso desde sesión móvil (sin JWT) */
export async function analizarDocumentoMovil(
  frenteBase64: string,
  reversoBase64: string
): Promise<{ data: AnalisisOCRResponse | null; error: string | null }> {
  try {
    const data = await api.post<AnalisisOCRResponse>(
      "/kyc/mobile/analizar-completo",
      { frente_base64: frenteBase64, reverso_base64: reversoBase64 }
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export interface ActualizarEstadoMovilInput {
  token: string;
  estado: EstadoKyc;
  safe_score?: number;
  nfc_verificado?: boolean;
  nombre_extraido?: string;
  apellidos_extraidos?: string;
  dni_extraido?: string;
  tipo_documento?: string;
  datos_raw?: Record<string, unknown>;
}

/** Reporta el resultado final del escaneo al backend (móvil → web) */
export async function actualizarEstadoKycMovil(
  input: ActualizarEstadoMovilInput
): Promise<{ error: string | null }> {
  try {
    await api.patch("/kyc/mobile/estado", input);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

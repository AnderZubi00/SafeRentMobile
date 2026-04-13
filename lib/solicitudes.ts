import { api } from "./api";

export interface Solicitud {
  id: string;
  vivienda_id: string;
  inquilino_id: string;
  propietario_id: string;
  motivo: string;
  motivo_detalle: string | null;
  documento_identidad_url: string;
  documento_justificativo_url: string;
  fecha_entrada: string;
  fecha_salida: string;
  estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
  motivo_rechazo: string | null;
  fecha_creacion: string;
  vivienda?: {
    id: string;
    titulo: string;
    ciudad: string;
    barrio: string | null;
    direccion: string;
    precio_mes: number;
    fianza_importe: number;
    fotos: string[];
    estancia_minima: number;
    estancia_maxima: number;
    propietario_id: string;
  };
  inquilino?: {
    id: string;
    nombre_completo: string;
    email: string;
    dni_nie: string | null;
  };
  // Aliases retro-compatibles
  viviendas?: Solicitud["vivienda"];
  usuarios?: Solicitud["inquilino"];
}

export interface CrearSolicitudInput {
  vivienda_id: string;
  propietario_id: string;
  motivo: string;
  motivo_detalle?: string;
  fecha_entrada: string;
  fecha_salida: string;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UploadUrlsDocs {
  identidad: { signedUrl: string; publicUrl: string };
  justificativo: { signedUrl: string; publicUrl: string };
}

/**
 * Genera signed URLs para subir documentos (identidad + justificativo).
 * Se usa un ID temporal para agrupar las rutas de storage.
 */
export async function obtenerUrlsDocsSolicitud(
  tempId: string
): Promise<UploadUrlsDocs> {
  return api.post<UploadUrlsDocs>(`/solicitudes/${tempId}/docs/upload-url`);
}

/**
 * Sube documentos locales (URIs del device) a Supabase via signed URLs y
 * luego crea la solicitud en el backend.
 */
export async function crearSolicitud(
  input: CrearSolicitudInput,
  docIdentidadUri: string,
  docIdentidadType: string,
  docJustificativoUri: string,
  docJustificativoType: string
): Promise<{ data: Solicitud | null; error: string | null }> {
  try {
    const tempId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const urls = await obtenerUrlsDocsSolicitud(tempId);

    const [blobId, blobJust] = await Promise.all([
      (await fetch(docIdentidadUri)).blob(),
      (await fetch(docJustificativoUri)).blob(),
    ]);

    await Promise.all([
      fetch(urls.identidad.signedUrl, {
        method: "PUT",
        body: blobId,
        headers: { "Content-Type": docIdentidadType },
      }),
      fetch(urls.justificativo.signedUrl, {
        method: "PUT",
        body: blobJust,
        headers: { "Content-Type": docJustificativoType },
      }),
    ]);

    const data = await api.post<Solicitud>("/solicitudes", {
      ...input,
      documento_identidad_url: urls.identidad.publicUrl,
      documento_justificativo_url: urls.justificativo.publicUrl,
    });

    return { data, error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Error al crear solicitud",
    };
  }
}

export async function obtenerSolicitudesPropietario(): Promise<{
  data: Solicitud[];
  error: string | null;
}> {
  try {
    const res = await api.get<Paginated<Solicitud>>("/solicitudes/propietario");
    const mapped = res.data.map((s) => ({
      ...s,
      viviendas: s.vivienda,
      usuarios: s.inquilino,
    }));
    return { data: mapped, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerSolicitudesInquilino(): Promise<{
  data: Solicitud[];
  error: string | null;
}> {
  try {
    const res = await api.get<Paginated<Solicitud>>("/solicitudes/inquilino");
    const mapped = res.data.map((s) => ({ ...s, viviendas: s.vivienda }));
    return { data: mapped, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerSolicitudById(
  id: string
): Promise<{ data: Solicitud | null; error: string | null }> {
  try {
    const data = await api.get<Solicitud>(`/solicitudes/${id}`);
    return {
      data: { ...data, viviendas: data.vivienda, usuarios: data.inquilino },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerEstadoSolicitud(solicitudId: string): Promise<{
  estado: string;
  motivo_rechazo: string | null;
  contrato?: {
    id: string;
    firmado_propietario: boolean;
    firmado_inquilino: boolean;
    pdf_borrador_url: string | null;
  } | null;
  pagos_completados?: number;
  fecha_entrada?: string;
  fecha_salida?: string;
  error: string | null;
}> {
  try {
    const data = await api.get<{
      estado: string;
      motivo_rechazo: string | null;
      contrato: {
        id: string;
        firmado_propietario: boolean;
        firmado_inquilino: boolean;
        pdf_borrador_url: string | null;
      } | null;
      pagos_completados?: number;
      fecha_entrada?: string;
      fecha_salida?: string;
    }>(`/solicitudes/${solicitudId}/estado`);
    return { ...data, error: null };
  } catch (e) {
    return {
      estado: "ERROR",
      motivo_rechazo: null,
      error: e instanceof Error ? e.message : "Error",
    };
  }
}

export async function aceptarSolicitud(
  id: string
): Promise<{ error: string | null }> {
  try {
    await api.post(`/solicitudes/${id}/aceptar`);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function rechazarSolicitud(
  id: string,
  motivo: string
): Promise<{ error: string | null }> {
  try {
    await api.post(`/solicitudes/${id}/rechazar`, { motivo_rechazo: motivo });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function contarSolicitudesPendientes(): Promise<number> {
  try {
    const res = await api.get<{ count: number }>("/solicitudes/pendientes/count");
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

import { api } from "./api";

export type MotivoTemporalidad =
  | "Estudios"
  | "Trabajo"
  | "Obras"
  | "Salud"
  | "Otros";

export interface Vivienda {
  id: string;
  propietario_id: string;
  titulo: string;
  descripcion: string | null;
  direccion: string;
  barrio: string | null;
  ciudad: string;
  provincia: string;
  precio_mes: number;
  fianza_importe: number;
  habitaciones: number;
  banos: number;
  m2: number;
  motivos: string[];
  num_registro_vivienda: string;
  nota_simple_url: string | null;
  verificada: boolean;
  activa: boolean;
  disponible_desde: string | null;
  duracion_minima: string;
  estancia_minima: number;
  estancia_maxima: number;
  fotos: string[];
  fecha_creacion: string;
  fase_actual: number;
  es_borrador: boolean;
}

export interface PublicarViviendaInput {
  titulo: string;
  descripcion?: string;
  direccion: string;
  barrio?: string;
  ciudad: string;
  provincia: string;
  precio_mes: number;
  fianza_importe: number;
  habitaciones: number;
  banos: number;
  m2: number;
  motivos: string[];
  num_registro_vivienda: string;
  disponible_desde?: string;
  estancia_minima: number;
  estancia_maxima: number;
  /** PATCH parcial (p. ej. toggle visible/pausada en listados) */
  activa?: boolean;
}

export interface FiltrosVivienda {
  provincia?: string;
  ciudad?: string;
  motivo?: string;
  precioMin?: number;
  precioMax?: number;
  habitaciones?: number;
  soloVerificadas?: boolean;
  page?: number;
  limit?: number;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Construye la URL pública de una foto en Supabase Storage (bucket viviendas-fotos) */
export function getPublicPhotoUrl(path: string): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  return `${supabaseUrl}/storage/v1/object/public/viviendas-fotos/${path}`;
}

// ---------------------------------------------------------------------------
// Creación directa (crea vivienda sin wizard; equivalente al POST /viviendas del web)
// ---------------------------------------------------------------------------

export async function publicarVivienda(
  input: PublicarViviendaInput
): Promise<{ data: Vivienda | null; error: string | null }> {
  try {
    const data = await api.post<Vivienda>("/viviendas", input);
    return { data, error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Error al publicar vivienda",
    };
  }
}

// ---------------------------------------------------------------------------
// Búsqueda y lectura
// ---------------------------------------------------------------------------

export async function obtenerViviendas(
  filtros?: FiltrosVivienda
): Promise<{ data: Vivienda[]; error: string | null }> {
  try {
    const params = new URLSearchParams();
    if (filtros?.provincia && filtros.provincia !== "todas")
      params.set("provincia", filtros.provincia);
    if (filtros?.ciudad && filtros.ciudad !== "todas")
      params.set("ciudad", filtros.ciudad);
    if (filtros?.motivo && filtros.motivo !== "todos")
      params.set("motivo", filtros.motivo);
    if (filtros?.precioMin !== undefined)
      params.set("precioMin", String(filtros.precioMin));
    if (filtros?.precioMax !== undefined)
      params.set("precioMax", String(filtros.precioMax));
    if (filtros?.habitaciones !== undefined && filtros.habitaciones > 0)
      params.set("habitaciones", String(filtros.habitaciones));
    if (filtros?.soloVerificadas === true)
      params.set("soloVerificadas", "true");
    if (filtros?.page !== undefined) params.set("page", String(filtros.page));
    if (filtros?.limit !== undefined)
      params.set("limit", String(filtros.limit));

    const query = params.toString();
    const res = await api.get<Paginated<Vivienda>>(
      `/viviendas${query ? `?${query}` : ""}`
    );
    return { data: res.data, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Error al obtener viviendas",
    };
  }
}

export async function obtenerViviendaById(
  id: string
): Promise<{ data: Vivienda | null; error: string | null }> {
  try {
    const data = await api.get<Vivienda>(`/viviendas/${id}`);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerMisViviendas(): Promise<{
  data: Vivienda[];
  error: string | null;
}> {
  try {
    const res = await api.get<Paginated<Vivienda>>("/viviendas/mis-viviendas");
    return { data: res.data, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

// ---------------------------------------------------------------------------
// Actualización (PATCH parcial; protege fotos si no se pasan explícitamente)
// ---------------------------------------------------------------------------

export async function actualizarVivienda(
  id: string,
  input: Partial<PublicarViviendaInput>
): Promise<{ data: Vivienda | null; error: string | null }> {
  try {
    const data = await api.patch<Vivienda>(`/viviendas/${id}`, input);
    return { data, error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Error al actualizar",
    };
  }
}

// ---------------------------------------------------------------------------
// Wizard de 5 fases (borradores)
// ---------------------------------------------------------------------------

/** Crea un borrador con solo el título (fase 1) */
export async function crearBorrador(titulo: string): Promise<Vivienda> {
  return api.post<Vivienda>("/viviendas/borrador", { titulo });
}

/** Guarda datos parciales en una fase específica (2..5) */
export async function guardarFase(
  id: string,
  faseNum: number,
  data: Record<string, unknown>
): Promise<Vivienda> {
  return api.patch<Vivienda>(`/viviendas/${id}/fase/${faseNum}`, data);
}

/** Lista todos los borradores del usuario autenticado */
export async function obtenerBorradores(): Promise<Vivienda[]> {
  const res = await api.get<Paginated<Vivienda>>("/viviendas/borradores");
  return res.data;
}

/** Publica una vivienda (valida todos los campos en backend) */
export async function publicarViviendaFinal(id: string): Promise<Vivienda> {
  return api.post<Vivienda>(`/viviendas/${id}/publicar`);
}

/** Marca la vivienda como verificada (fase final) */
export async function verificarVivienda(id: string): Promise<Vivienda> {
  return api.post<Vivienda>(`/viviendas/${id}/verificar`);
}

/** Elimina un borrador */
export async function eliminarBorrador(
  id: string
): Promise<{ error: string | null }> {
  try {
    await api.delete(`/viviendas/${id}/borrador`);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

// ---------------------------------------------------------------------------
// Uploads (signed URLs)
// ---------------------------------------------------------------------------

/** Genera una signed URL para subir una foto de vivienda a Supabase Storage */
export async function obtenerUrlFotoUpload(
  viviendaId: string,
  filename: string
): Promise<{ signedUrl: string; publicUrl: string }> {
  return api.post<{ signedUrl: string; publicUrl: string }>(
    `/viviendas/${viviendaId}/fotos/upload-url`,
    { filename }
  );
}

/** Genera una signed URL para subir la nota simple (documento catastral) */
export async function obtenerUrlNotaSimple(
  viviendaId: string
): Promise<{ signedUrl: string; publicUrl: string }> {
  return api.post<{ signedUrl: string; publicUrl: string }>(
    `/viviendas/${viviendaId}/nota-simple/upload-url`
  );
}

/**
 * Helper React Native: sube un fichero local (URI del device) a la signed URL.
 * Devuelve la publicUrl si la subida fue OK.
 */
export async function subirArchivoLocal(
  signedUrl: string,
  localUri: string,
  contentType: string
): Promise<boolean> {
  // En RN, fetch soporta pasar un Blob construido desde un Uri de archivo.
  const blob = await (await fetch(localUri)).blob();
  const res = await fetch(signedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  return res.ok;
}

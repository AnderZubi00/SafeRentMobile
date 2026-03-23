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
  // Aliases for backward compatibility
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

export async function obtenerSolicitudesPropietario(): Promise<{
  data: Solicitud[];
  error: string | null;
}> {
  try {
    const data = await api.get<Solicitud[]>("/solicitudes/propietario");
    const mapped = data.map((s) => ({
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
    const data = await api.get<Solicitud[]>("/solicitudes/inquilino");
    const mapped = data.map((s) => ({ ...s, viviendas: s.vivienda }));
    return { data: mapped, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
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
    const count = await api.get<number>("/solicitudes/pendientes/count");
    return count;
  } catch {
    return 0;
  }
}

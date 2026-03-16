import { supabase } from "./supabase";

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
  viviendas?: {
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
  usuarios?: {
    id: string;
    nombre_completo: string;
    email: string;
    dni_nie: string | null;
  };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "No autenticado" };

  const { data, error } = await supabase
    .from("solicitudes")
    .select(
      "*, viviendas(id, titulo, ciudad, barrio, direccion, precio_mes, fianza_importe, fotos, estancia_minima, estancia_maxima, propietario_id), usuarios!solicitudes_inquilino_id_fkey(id, nombre_completo, email, dni_nie)"
    )
    .eq("propietario_id", user.id)
    .order("fecha_creacion", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as Solicitud[]) ?? [], error: null };
}

export async function obtenerSolicitudesInquilino(): Promise<{
  data: Solicitud[];
  error: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "No autenticado" };

  const { data, error } = await supabase
    .from("solicitudes")
    .select(
      "*, viviendas(id, titulo, ciudad, barrio, direccion, precio_mes, fianza_importe, fotos, estancia_minima, estancia_maxima, propietario_id)"
    )
    .eq("inquilino_id", user.id)
    .order("fecha_creacion", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as Solicitud[]) ?? [], error: null };
}

export async function aceptarSolicitud(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "ACEPTADA" })
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function rechazarSolicitud(
  id: string,
  motivo: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "RECHAZADA", motivo_rechazo: motivo })
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function contarSolicitudesPendientes(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("solicitudes")
    .select("*", { count: "exact", head: true })
    .eq("propietario_id", user.id)
    .eq("estado", "PENDIENTE");

  if (error) return 0;
  return count ?? 0;
}

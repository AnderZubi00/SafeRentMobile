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
}

export interface PublicarViviendaInput {
  titulo: string;
  descripcion?: string;
  direccion: string;
  barrio?: string;
  ciudad: string;
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
}

export interface FiltrosVivienda {
  ciudad?: string;
  motivo?: string;
  precioMin?: number;
  precioMax?: number;
  habitaciones?: number;
}

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

export async function obtenerViviendas(
  filtros?: FiltrosVivienda
): Promise<{ data: Vivienda[]; error: string | null }> {
  try {
    const params = new URLSearchParams();
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

    const query = params.toString();
    const data = await api.get<Vivienda[]>(
      `/viviendas${query ? `?${query}` : ""}`
    );
    return { data, error: null };
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
    const data = await api.get<Vivienda[]>("/viviendas/mis-viviendas");
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function actualizarVivienda(
  id: string,
  input: Partial<PublicarViviendaInput & { activa?: boolean }>
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

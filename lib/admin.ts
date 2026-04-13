import { api } from "./api";

export interface AdminStats {
  usuarios: number;
  viviendas: number;
  solicitudes: number;
  pagos_total: number;
}

export interface PropietarioAdmin {
  id: string;
  email: string;
  nombre_completo: string;
  rol: string;
  verificado_kyc: boolean;
  stripe_onboarding_complete: boolean;
  fecha_creacion: string;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function obtenerStatsAdmin(): Promise<{
  data: AdminStats | null;
  error: string | null;
}> {
  try {
    const data = await api.get<AdminStats>("/admin/stats");
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerPropietariosAdmin(page = 1, limit = 20): Promise<{
  data: PropietarioAdmin[];
  total: number;
  error: string | null;
}> {
  try {
    const res = await api.get<Paginated<PropietarioAdmin>>(
      `/admin/propietarios?page=${page}&limit=${limit}`
    );
    return { data: res.data, total: res.total, error: null };
  } catch (e) {
    return { data: [], total: 0, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Alterna el estado verificado_kyc de un usuario (toggle) */
export async function toggleKycUsuario(
  usuarioId: string
): Promise<{ error: string | null }> {
  try {
    await api.patch(`/admin/usuarios/${usuarioId}/kyc`, {});
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

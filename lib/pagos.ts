import { supabase } from "./supabase";

export interface Pago {
  id: string;
  solicitud_id: string;
  inquilino_id: string;
  vivienda_id: string;
  concepto: string;
  importe: number;
  estado: string;
  fecha_pago: string;
  metodo: string;
  viviendas?: {
    titulo: string;
    ciudad: string;
  };
}

export interface PagoPropietario extends Pago {
  solicitudes?: {
    inquilino_id: string;
    motivo: string;
    fecha_entrada: string;
    fecha_salida: string;
    usuarios?: {
      nombre_completo: string;
      email: string;
    };
  };
}

export async function obtenerPagosInquilino(): Promise<{
  data: Pago[];
  error: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "No autenticado" };

  const { data, error } = await supabase
    .from("pagos")
    .select("*, viviendas(titulo, ciudad)")
    .eq("inquilino_id", user.id)
    .order("fecha_pago", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as Pago[]) ?? [], error: null };
}

export async function obtenerPagosPropietario(): Promise<{
  data: PagoPropietario[];
  error: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "No autenticado" };

  const { data, error } = await supabase
    .from("pagos")
    .select(
      "*, viviendas!inner(titulo, ciudad, propietario_id), solicitudes(inquilino_id, motivo, fecha_entrada, fecha_salida, usuarios!solicitudes_inquilino_id_fkey(nombre_completo, email))"
    )
    .eq("viviendas.propietario_id", user.id)
    .order("fecha_pago", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as PagoPropietario[]) ?? [], error: null };
}

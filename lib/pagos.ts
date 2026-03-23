import { api } from "./api";

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
  vivienda?: {
    titulo: string;
    ciudad: string;
  };
}

export interface PagoPropietario extends Pago {
  solicitud?: {
    inquilino_id: string;
    motivo: string;
    fecha_entrada: string;
    fecha_salida: string;
    inquilino?: {
      nombre_completo: string;
      email: string;
    };
  };
}

export async function obtenerPagosInquilino(): Promise<{
  data: Pago[];
  error: string | null;
}> {
  try {
    const data = await api.get<Pago[]>("/pagos/inquilino");
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerPagosPropietario(): Promise<{
  data: PagoPropietario[];
  error: string | null;
}> {
  try {
    const data = await api.get<PagoPropietario[]>("/pagos/propietario");
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

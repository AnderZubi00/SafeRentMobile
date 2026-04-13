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
  comision_plataforma?: number;
  comision_host?: number;
  comision_guest?: number;
  importe_propietario?: number;
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

export interface RegistrarPagoInput {
  solicitud_id: string;
  vivienda_id: string;
  concepto: string;
  importe: number;
  fianza_importe?: number;
  metodo?: string;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function registrarPago(
  input: RegistrarPagoInput
): Promise<{ data: Pago | null; error: string | null }> {
  try {
    const data = await api.post<Pago>("/pagos", input);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerPagosInquilino(): Promise<{
  data: Pago[];
  error: string | null;
}> {
  try {
    const res = await api.get<Paginated<Pago>>("/pagos/inquilino");
    return { data: res.data, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function obtenerPagosPropietario(): Promise<{
  data: PagoPropietario[];
  error: string | null;
}> {
  try {
    const res = await api.get<Paginated<PagoPropietario>>("/pagos/propietario");
    return { data: res.data, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export interface FeeBreakdown {
  guestFee: number;
  hostFee: number;
  platformTotal: number;
  totalCharge: number;
  propietarioNet: number;
}

export async function obtenerFeePreview(amount: number): Promise<{
  data: FeeBreakdown | null;
  error: string | null;
}> {
  try {
    const data = await api.get<FeeBreakdown>(
      `/pagos/fee-preview?amount=${amount}`
    );
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function crearPaymentIntent(input: RegistrarPagoInput): Promise<{
  data: {
    clientSecret: string;
    paymentIntentId: string;
    breakdown?: FeeBreakdown;
  } | null;
  error: string | null;
}> {
  try {
    const data = await api.post<{
      clientSecret: string;
      paymentIntentId: string;
      breakdown?: FeeBreakdown;
    }>("/pagos/create-intent", input);
    return { data, error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Error al crear el pago",
    };
  }
}

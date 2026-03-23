import { api } from "./api";

export interface ContratoDigital {
  id: string;
  solicitud_id: string;
  reserva_id: string | null;
  pdf_borrador_url: string | null;
  pdf_final_url: string | null;
  firmado_propietario: boolean;
  firmado_inquilino: boolean;
  firma_propietario_img: string | null;
  firma_inquilino_img: string | null;
  fecha_firma_completa: string | null;
}

export async function obtenerContratoBySolicitud(
  solicitudId: string
): Promise<{ data: ContratoDigital | null; error: string | null }> {
  try {
    const data = await api.get<ContratoDigital>(
      `/contratos/solicitud/${solicitudId}`
    );
    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no encontrado") || msg.includes("404")) {
      return { data: null, error: null };
    }
    return { data: null, error: msg || "Error" };
  }
}

export async function firmarContrato(
  contratoId: string,
  _rol: "propietario" | "inquilino",
  firmaBase64: string
): Promise<{ error: string | null }> {
  try {
    // El backend determina el rol desde el JWT
    await api.post(`/contratos/${contratoId}/firmar`, {
      firma_base64: firmaBase64,
    });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

import { create } from "zustand";
import {
  obtenerSolicitudesInquilino,
  type Solicitud,
} from "@/lib/solicitudes";
import { obtenerPagosInquilino, type Pago } from "@/lib/pagos";
import { obtenerContratoBySolicitud, type ContratoDigital } from "@/lib/contratos";

export interface SolicitudConContrato extends Solicitud {
  contrato?: ContratoDigital | null;
}

export interface DocumentoInquilino {
  id: string;
  tipo: "identidad" | "temporalidad" | "contrato";
  nombre: string;
  url: string;
  estado: "verificado" | "firmado" | "pendiente" | "rechazado";
  fecha: string;
  viviendaTitulo: string;
  viviendaCiudad: string;
  solicitudId: string;
  motivo?: string;
}

interface InquilinoState {
  solicitudes: SolicitudConContrato[];
  documentos: DocumentoInquilino[];
  pagos: Pago[];
  cargando: boolean;
  cargar: () => Promise<void>;
  recargar: () => Promise<void>;
  reset: () => void;
}

let _cargarRunning = false;

function derivarDocumentos(
  solicitudes: SolicitudConContrato[]
): DocumentoInquilino[] {
  const docs: DocumentoInquilino[] = [];

  for (const sol of solicitudes) {
    const viviendaTitulo = sol.viviendas?.titulo ?? "Vivienda";
    const viviendaCiudad = sol.viviendas?.ciudad ?? "";
    const estadoDoc =
      sol.estado === "RECHAZADA"
        ? ("rechazado" as const)
        : sol.estado === "ACEPTADA"
          ? ("verificado" as const)
          : ("pendiente" as const);

    if (sol.documento_identidad_url) {
      docs.push({
        id: `dni-${sol.id}`,
        tipo: "identidad",
        nombre: "Documento de identidad (DNI/NIE)",
        url: sol.documento_identidad_url,
        estado: estadoDoc,
        fecha: sol.fecha_creacion,
        viviendaTitulo,
        viviendaCiudad,
        solicitudId: sol.id,
      });
    }

    if (sol.documento_justificativo_url) {
      const motivoLabel =
        sol.motivo === "Estudios"
          ? "Matrícula / Justificante de estudios"
          : sol.motivo === "Trabajo temporal"
            ? "Contrato laboral / Justificante de trabajo"
            : `Justificante — ${sol.motivo_detalle ?? sol.motivo}`;

      docs.push({
        id: `just-${sol.id}`,
        tipo: "temporalidad",
        nombre: motivoLabel,
        url: sol.documento_justificativo_url,
        estado: estadoDoc,
        fecha: sol.fecha_creacion,
        viviendaTitulo,
        viviendaCiudad,
        solicitudId: sol.id,
        motivo: sol.motivo,
      });
    }

    if (sol.contrato?.pdf_borrador_url) {
      const firmadoAmbos =
        sol.contrato.firmado_propietario && sol.contrato.firmado_inquilino;
      docs.push({
        id: `contrato-${sol.id}`,
        tipo: "contrato",
        nombre: `Contrato temporal — ${viviendaTitulo}`,
        url: sol.contrato.pdf_borrador_url,
        estado: firmadoAmbos ? "firmado" : "pendiente",
        fecha: sol.contrato.fecha_firma_completa ?? sol.fecha_creacion,
        viviendaTitulo,
        viviendaCiudad,
        solicitudId: sol.id,
      });
    }
  }

  return docs;
}

const initial = {
  solicitudes: [] as SolicitudConContrato[],
  documentos: [] as DocumentoInquilino[],
  pagos: [] as Pago[],
  cargando: false,
};

export const useInquilinoStore = create<InquilinoState>((set, get) => ({
  ...initial,

  cargar: async () => {
    if (_cargarRunning || get().solicitudes.length > 0) return;
    _cargarRunning = true;
    set({ cargando: true });

    try {
      const [solResult, pagosResult] = await Promise.all([
        obtenerSolicitudesInquilino(),
        obtenerPagosInquilino(),
      ]);

      const conContratos: SolicitudConContrato[] = [];
      for (const sol of solResult.data) {
        let contrato: ContratoDigital | null = null;
        if (sol.estado === "ACEPTADA") {
          const { data } = await obtenerContratoBySolicitud(sol.id);
          contrato = data;
        }
        conContratos.push({ ...sol, contrato });
      }

      set({
        solicitudes: conContratos,
        documentos: derivarDocumentos(conContratos),
        pagos: pagosResult.data,
        cargando: false,
      });
    } catch (err) {
      console.error("Error cargando datos del inquilino:", err);
      set({ cargando: false });
    } finally {
      _cargarRunning = false;
    }
  },

  recargar: async () => {
    _cargarRunning = false;
    set({ solicitudes: [], documentos: [], pagos: [] });
    await get().cargar();
  },

  reset: () => {
    _cargarRunning = false;
    set({ ...initial });
  },
}));

/** Alias retro-compatible */
export function useInquilino() {
  return useInquilinoStore();
}

import { create } from "zustand";
import {
  obtenerMisViviendas,
  type Vivienda,
} from "@/lib/viviendas";
import {
  obtenerSolicitudesPropietario,
  type Solicitud,
} from "@/lib/solicitudes";
import { obtenerPagosPropietario, type PagoPropietario } from "@/lib/pagos";
import {
  obtenerContratoBySolicitud,
  type ContratoDigital,
} from "@/lib/contratos";

export interface SolicitudConContrato extends Solicitud {
  contrato?: ContratoDigital | null;
}

interface PropietarioState {
  viviendas: Vivienda[];
  solicitudes: SolicitudConContrato[];
  pagos: PagoPropietario[];
  solicitudesPendientes: number;
  cargando: boolean;
  /** Carga los datos del propietario (idempotente si ya están cargados) */
  cargar: () => Promise<void>;
  /** Fuerza recarga completa */
  recargar: () => Promise<void>;
  /** Actualización optimista local de una vivienda (ej: toggle activa) */
  actualizarViviendaLocal: (id: string, patch: Partial<Vivienda>) => void;
  /** Limpia el estado (llamado en logout) */
  reset: () => void;
}

// Bandera para evitar cargas concurrentes (StrictMode doble-mount)
let _cargarRunning = false;

const initial = {
  viviendas: [] as Vivienda[],
  solicitudes: [] as SolicitudConContrato[],
  pagos: [] as PagoPropietario[],
  solicitudesPendientes: 0,
  cargando: false,
};

export const usePropietarioStore = create<PropietarioState>((set, get) => ({
  ...initial,

  cargar: async () => {
    if (_cargarRunning || get().viviendas.length > 0) return;
    _cargarRunning = true;
    set({ cargando: true });

    try {
      const [vivResult, solResult, pagResult] = await Promise.all([
        obtenerMisViviendas(),
        obtenerSolicitudesPropietario(),
        obtenerPagosPropietario(),
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
        viviendas: vivResult.data,
        solicitudes: conContratos,
        pagos: pagResult.data,
        solicitudesPendientes: conContratos.filter(
          (s) => s.estado === "PENDIENTE"
        ).length,
        cargando: false,
      });
    } catch (err) {
      console.error("Error cargando datos del propietario:", err);
      set({ cargando: false });
    } finally {
      _cargarRunning = false;
    }
  },

  recargar: async () => {
    _cargarRunning = false;
    // Reiniciar para forzar recarga
    set({ viviendas: [], solicitudes: [], pagos: [], solicitudesPendientes: 0 });
    await get().cargar();
  },

  actualizarViviendaLocal: (id, patch) => {
    set((state) => ({
      viviendas: state.viviendas.map((v) =>
        v.id === id ? { ...v, ...patch } : v
      ),
    }));
  },

  reset: () => {
    _cargarRunning = false;
    set({ ...initial });
  },
}));

/** Alias retro-compatible */
export function usePropietario() {
  return usePropietarioStore();
}

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { api, setBackendToken, clearBackendToken } from "@/lib/api";
import type { UsuarioAuth } from "@/lib/auth";

interface AuthState {
  /** undefined = cargando, null = sin sesión, UsuarioAuth = autenticado */
  usuario: UsuarioAuth | null | undefined;
  cargando: boolean;
  setUsuario: (u: UsuarioAuth | null) => void;
  cerrarSesion: () => Promise<void>;
  /**
   * Inicia el listener de Supabase y la carga inicial.
   * Devuelve una función de limpieza para desuscribirse.
   * Debe llamarse una única vez desde el root layout.
   */
  _init: () => () => void;
}

// Bandera de módulo para evitar doble-init en StrictMode
let _initRunning = false;

export const useAuthStore = create<AuthState>((set) => ({
  usuario: undefined,
  cargando: true,

  setUsuario: (u) => set({ usuario: u, cargando: false }),

  cerrarSesion: async () => {
    await supabase.auth.signOut();
    await clearBackendToken();
    set({ usuario: null, cargando: false });
    // Reset lazy para evitar dependencia circular
    const { usePropietarioStore } = await import("./propietarioStore");
    const { useInquilinoStore } = await import("./inquilinoStore");
    usePropietarioStore.getState().reset();
    useInquilinoStore.getState().reset();
  },

  _init: () => {
    if (_initRunning) return () => {};
    _initRunning = true;

    async function cargarPerfil() {
      try {
        const perfil = await api.get<UsuarioAuth>("/auth/me");
        set({ usuario: perfil, cargando: false });
      } catch {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            const result = await api.post<{
              access_token: string;
              usuario: UsuarioAuth;
            }>("/auth/exchange", { supabase_token: session.access_token });
            await setBackendToken(result.access_token);
            set({ usuario: result.usuario, cargando: false });
          } else {
            set({ usuario: null, cargando: false });
          }
        } catch {
          await supabase.auth.signOut();
          set({ usuario: null, cargando: false });
        }
      }
    }

    cargarPerfil();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.access_token) {
        await clearBackendToken();
        set({ usuario: null, cargando: false });
        const { usePropietarioStore } = await import("./propietarioStore");
        const { useInquilinoStore } = await import("./inquilinoStore");
        usePropietarioStore.getState().reset();
        useInquilinoStore.getState().reset();
        return;
      }
      try {
        const result = await api.post<{
          access_token: string;
          usuario: UsuarioAuth;
        }>("/auth/exchange", { supabase_token: session.access_token });
        await setBackendToken(result.access_token);
        set({ usuario: result.usuario, cargando: false });
      } catch {
        set({ usuario: null, cargando: false });
      }
    });

    return () => {
      subscription.unsubscribe();
      _initRunning = false;
    };
  },
}));

/** Alias retro-compatible (mismo nombre que el antiguo hook del Context) */
export function useAuth() {
  return useAuthStore();
}

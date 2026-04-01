import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { UsuarioAuth } from "@/lib/auth";

interface AuthState {
  /** undefined = cargando, null = sin sesión, UsuarioAuth = logueado */
  usuario: UsuarioAuth | null | undefined;
  cargando: boolean;
  setUsuario: (usuario: UsuarioAuth | null) => void;
  cerrarSesion: () => Promise<void>;
  /** Inicializa la suscripción de Supabase Auth. Devuelve la función de cleanup. */
  _init: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: undefined,
  cargando: true,

  setUsuario: (usuario) => set({ usuario, cargando: false }),

  cerrarSesion: async () => {
    await supabase.auth.signOut();
    set({ usuario: null, cargando: false });
  },

  _init: () => {
    // Carga el perfil de la sesión activa al arrancar
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        set({ usuario: null, cargando: false });
        return;
      }
      const { data: perfil } = await supabase
        .from("usuarios")
        .select("id, email, nombre_completo, rol, verificado_kyc")
        .eq("id", user.id)
        .single();
      set({ usuario: (perfil as UsuarioAuth) ?? null, cargando: false });
    });

    // Escucha cambios de sesión (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        set({ usuario: null, cargando: false });
        return;
      }
      const { data: perfil } = await supabase
        .from("usuarios")
        .select("id, email, nombre_completo, rol, verificado_kyc")
        .eq("id", session.user.id)
        .single();
      set({ usuario: (perfil as UsuarioAuth) ?? null, cargando: false });
    });

    return () => subscription.unsubscribe();
  },
}));

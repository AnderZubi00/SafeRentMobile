import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { UsuarioAuth } from "@/lib/auth";

interface AuthState {
  usuario: UsuarioAuth | null | undefined;
  cargando: boolean;
  setUsuario: (u: UsuarioAuth | null) => void;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  usuario: undefined,
  cargando: true,
  setUsuario: () => {},
  cerrarSesion: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioAuth | null | undefined>(
    undefined
  );

  useEffect(() => {
    async function cargarPerfil() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          // Token inválido o expirado — limpiar sesión corrupta
          await supabase.auth.signOut();
          setUsuario(null);
          return;
        }

        const { data: perfil } = await supabase
          .from("usuarios")
          .select("id, email, nombre_completo, rol, verificado_kyc")
          .eq("id", user.id)
          .single();

        setUsuario((perfil as UsuarioAuth) ?? null);
      } catch {
        await supabase.auth.signOut();
        setUsuario(null);
      }
    }

    cargarPerfil();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUsuario(null);
        return;
      }

      supabase
        .from("usuarios")
        .select("id, email, nombre_completo, rol, verificado_kyc")
        .eq("id", session.user.id)
        .single()
        .then(({ data: perfil }) => {
          setUsuario((perfil as UsuarioAuth) ?? null);
        });
    });

    return () => subscription.unsubscribe();
  }, []);

  const cerrar = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuario(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      usuario,
      cargando: usuario === undefined,
      setUsuario,
      cerrarSesion: cerrar,
    }),
    [usuario, cerrar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

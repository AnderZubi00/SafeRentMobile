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
import { api, setBackendToken, clearBackendToken } from "@/lib/api";
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
        // Intentar obtener el usuario del backend con el JWT guardado
        const perfil = await api.get<UsuarioAuth>("/auth/me");
        setUsuario(perfil);
      } catch {
        // No hay JWT válido — intentar exchange con Supabase session
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const result = await api.post<{
              access_token: string;
              usuario: UsuarioAuth;
            }>("/auth/exchange", { supabase_token: session.access_token });
            await setBackendToken(result.access_token);
            setUsuario(result.usuario);
          } else {
            setUsuario(null);
          }
        } catch {
          await supabase.auth.signOut();
          setUsuario(null);
        }
      }
    }

    cargarPerfil();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.access_token) {
        await clearBackendToken();
        setUsuario(null);
        return;
      }

      try {
        const result = await api.post<{
          access_token: string;
          usuario: UsuarioAuth;
        }>("/auth/exchange", { supabase_token: session.access_token });
        await setBackendToken(result.access_token);
        setUsuario(result.usuario);
      } catch {
        setUsuario(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const cerrar = useCallback(async () => {
    await supabase.auth.signOut();
    await clearBackendToken();
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

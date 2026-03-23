import { supabase } from "./supabase";
import { api, setBackendToken, clearBackendToken } from "./api";

export type Rol = "INQUILINO" | "PROPIETARIO" | "ADMINISTRADOR";

export interface UsuarioAuth {
  id: string;
  email: string;
  nombre_completo: string;
  rol: Rol;
  verificado_kyc: boolean;
}

export function rutaSegunRol(rol: Rol): string {
  switch (rol) {
    case "INQUILINO":
      return "/(tabs)/(inquilino)";
    case "PROPIETARIO":
      return "/(tabs)/(propietario)";
    case "ADMINISTRADOR":
      return "/(tabs)/(admin)";
  }
}

/**
 * Intercambia un token de Supabase por un JWT del backend.
 * En registro, pasa nombre_completo y rol para crear el perfil automáticamente.
 */
async function exchangeForBackendJwt(
  supabaseAccessToken: string,
  registroData?: { nombre_completo: string; rol: Rol }
): Promise<UsuarioAuth> {
  const result = await api.post<{
    access_token: string;
    usuario: UsuarioAuth;
  }>("/auth/exchange", {
    supabase_token: supabaseAccessToken,
    ...registroData,
  });
  await setBackendToken(result.access_token);
  return result.usuario;
}

export async function loginConSupabase(
  email: string,
  password: string
): Promise<UsuarioAuth> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      throw new Error("Email o contraseña incorrectos");
    }
    if (error.message.includes("Email not confirmed")) {
      throw new Error("Debes confirmar tu email antes de acceder");
    }
    throw new Error(error.message);
  }

  return exchangeForBackendJwt(data.session.access_token);
}

export async function registrarConSupabase(
  email: string,
  password: string,
  nombre_completo: string,
  rol: Rol
): Promise<UsuarioAuth> {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (
      error.message.includes("already registered") ||
      error.message.includes("already exists")
    ) {
      throw new Error("Ya existe una cuenta con ese email");
    }
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("No se pudo crear el usuario");
  }

  // Exchange for backend JWT — el backend crea el perfil automáticamente
  if (data.session?.access_token) {
    return exchangeForBackendJwt(data.session.access_token, {
      nombre_completo,
      rol,
    });
  }

  // Si no hay sesión inmediata (email confirmation), devolver datos básicos
  return {
    id: data.user.id,
    email,
    nombre_completo,
    rol,
    verificado_kyc: false,
  };
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
  await clearBackendToken();
}

export async function obtenerUsuarioActual(): Promise<UsuarioAuth | null> {
  try {
    return await api.get<UsuarioAuth>("/auth/me");
  } catch {
    return null;
  }
}

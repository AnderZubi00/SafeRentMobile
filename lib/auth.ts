import { supabase } from "./supabase";

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

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("id, email, nombre_completo, rol, verificado_kyc")
    .eq("id", data.user.id)
    .single();

  if (perfilError || !perfil) {
    await supabase.auth.signOut();
    throw new Error("No se encontró el perfil del usuario");
  }

  return perfil as UsuarioAuth;
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

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .insert({
      id: data.user.id,
      email,
      nombre_completo,
      rol,
      contrasena_hash: "supabase_managed",
    })
    .select("id, email, nombre_completo, rol, verificado_kyc")
    .single();

  if (perfilError || !perfil) {
    throw new Error(
      "Error al guardar el perfil: " + (perfilError?.message ?? "")
    );
  }

  return perfil as UsuarioAuth;
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}

export async function obtenerUsuarioActual(): Promise<UsuarioAuth | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, email, nombre_completo, rol, verificado_kyc")
    .eq("id", user.id)
    .single();

  return (perfil as UsuarioAuth) ?? null;
}

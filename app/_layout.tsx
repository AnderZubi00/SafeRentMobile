import "@/global.css";
import { useEffect } from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/store/authStore";

/** Inicia el listener de Supabase y la carga inicial del usuario */
function AuthInit() {
  const _init = useAuthStore((s) => s._init);
  useEffect(() => {
    const cleanup = _init();
    return cleanup;
  }, [_init]);
  return null;
}

export default function RootLayout() {
  return (
    <>
      <AuthInit />
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}

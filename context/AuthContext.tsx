/**
 * Thin compatibility shim.
 * El estado de auth vive en store/authStore.ts (Zustand).
 * AuthProvider inicializa la suscripción de Supabase; useAuth lee del store.
 */

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";

export function AuthProvider({ children }: { children: ReactNode }) {
  const init = useAuthStore((s) => s._init);

  useEffect(() => {
    return init();
  }, [init]);

  return <>{children}</>;
}

/** Hook de autenticación — lee directamente del store Zustand. */
export function useAuth() {
  return useAuthStore();
}

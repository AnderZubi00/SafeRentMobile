import { useEffect } from "react";
import { Stack } from "expo-router";
import { useInquilinoStore } from "@/store/inquilinoStore";
import { useAuthStore } from "@/store/authStore";
import { useNotifications } from "@/hooks/useNotifications";

export default function InquilinoLayout() {
  const cargar = useInquilinoStore((s) => s.cargar);
  const recargar = useInquilinoStore((s) => s.recargar);
  const usuario = useAuthStore((s) => s.usuario);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Sincronización en tiempo real: cualquier cambio que afecte al inquilino
  // recarga el store automáticamente en todas las pantallas del panel.
  useNotifications(
    {
      "solicitud:updated": () => recargar(),
      "contrato:signed": () => recargar(),
      "pago:completed": () => recargar(),
    },
    !!usuario
  );

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f8fafc" },
      }}
    />
  );
}

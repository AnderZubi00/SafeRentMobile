import { useEffect } from "react";
import { Stack } from "expo-router";
import { usePropietarioStore } from "@/store/propietarioStore";
import { useAuthStore } from "@/store/authStore";
import { useNotifications } from "@/hooks/useNotifications";

export default function PropietarioLayout() {
  const cargar = usePropietarioStore((s) => s.cargar);
  const recargar = usePropietarioStore((s) => s.recargar);
  const usuario = useAuthStore((s) => s.usuario);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Sincronización en tiempo real: el propietario ve nuevas solicitudes,
  // contratos firmados y pagos completados sin refrescar manualmente.
  useNotifications(
    {
      "solicitud:created": () => recargar(),
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

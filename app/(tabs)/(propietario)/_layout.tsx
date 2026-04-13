import { useEffect } from "react";
import { Stack } from "expo-router";
import { usePropietarioStore } from "@/store/propietarioStore";

export default function PropietarioLayout() {
  const cargar = usePropietarioStore((s) => s.cargar);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f8fafc" },
      }}
    />
  );
}

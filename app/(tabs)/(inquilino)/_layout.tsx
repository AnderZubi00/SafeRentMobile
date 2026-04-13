import { useEffect } from "react";
import { Stack } from "expo-router";
import { useInquilinoStore } from "@/store/inquilinoStore";

export default function InquilinoLayout() {
  const cargar = useInquilinoStore((s) => s.cargar);

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

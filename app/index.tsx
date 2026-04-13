import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/authStore";
import { rutaSegunRol } from "@/lib/auth";

export default function Index() {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;

    if (!usuario) {
      router.replace("/(auth)/login");
    } else {
      router.replace(rutaSegunRol(usuario.rol) as any);
    }
  }, [usuario, cargando]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

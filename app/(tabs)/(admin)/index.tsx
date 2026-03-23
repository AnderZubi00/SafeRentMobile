import { useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, Home, ShieldCheck, AlertTriangle } from "lucide-react-native";
import { api } from "@/lib/api";
import { StatsCard } from "@/components/StatsCard";
import { Skeleton } from "@/components/ui/Skeleton";

interface AdminStats {
  totalUsuarios: number;
  totalViviendas: number;
  viviendasVerificadas: number;
  solicitudesPendientes: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsuarios: 0,
    totalViviendas: 0,
    viviendasVerificadas: 0,
    solicitudesPendientes: 0,
  });
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.get<AdminStats>("/admin/stats");
      setStats(data);
    } catch (err) {
      console.error("Error cargando stats admin:", err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={cargar}
            tintColor="#6366f1"
          />
        }
      >
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">
            Administración
          </Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Panel de control global
          </Text>
        </View>

        {cargando ? (
          <View className="px-5 gap-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </View>
        ) : (
          <>
            <View className="flex-row px-5 gap-3 mt-4">
              <StatsCard
                title="Usuarios"
                value={stats.totalUsuarios}
                icon={Users}
                color="#6366f1"
                iconBg="bg-indigo-50"
              />
              <StatsCard
                title="Viviendas"
                value={stats.totalViviendas}
                icon={Home}
                color="#10b981"
                iconBg="bg-emerald-50"
              />
            </View>

            <View className="flex-row px-5 gap-3 mt-3">
              <StatsCard
                title="Verificadas"
                value={stats.viviendasVerificadas}
                icon={ShieldCheck}
                color="#8b5cf6"
                iconBg="bg-violet-50"
              />
              <StatsCard
                title="Sol. pendientes"
                value={stats.solicitudesPendientes}
                icon={AlertTriangle}
                color="#f59e0b"
                iconBg="bg-amber-50"
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

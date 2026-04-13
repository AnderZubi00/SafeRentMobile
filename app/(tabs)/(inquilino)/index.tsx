import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Home, FileText, CreditCard, Clock, ShieldCheck } from "lucide-react-native";
import { router } from "expo-router";
import { useAuth } from "@/store/authStore";
import { useInquilino } from "@/store/inquilinoStore";
import { StatsCard } from "@/components/StatsCard";
import { SolicitudCard } from "@/components/SolicitudCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

export default function InquilinoDashboard() {
  const { usuario } = useAuth();
  const { solicitudes, documentos, pagos, cargando, recargar } = useInquilino();

  const nombre = usuario?.nombre_completo?.split(" ")[0] ?? "Inquilino";
  const solicitudesPendientes = solicitudes.filter(
    (s) => s.estado === "PENDIENTE"
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={recargar}
            tintColor="#6366f1"
          />
        }
      >
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">
            Hola, {nombre}
          </Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Panel del inquilino
          </Text>
        </View>

        {/* Banner KYC — solo si no está verificado */}
        {usuario && !usuario.verificado_kyc && (
          <Pressable
            className="mx-5 mt-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex-row items-center gap-3 active:bg-indigo-100"
            onPress={() => router.push("/kyc-movil")}
          >
            <ShieldCheck size={20} color="#6366f1" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-indigo-700">Verificar identidad</Text>
              <Text className="text-xs text-indigo-500 mt-0.5">Necesitás verificar tu DNI para enviar solicitudes</Text>
            </View>
            <Text className="text-xs font-medium text-indigo-600">→</Text>
          </Pressable>
        )}

        {cargando ? (
          <View className="px-5 gap-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </View>
        ) : (
          <>
            <View className="flex-row px-5 gap-3 mt-4">
              <StatsCard
                title="Solicitudes"
                value={solicitudes.length}
                icon={FileText}
                color="#6366f1"
                iconBg="bg-indigo-50"
              />
              <StatsCard
                title="Pendientes"
                value={solicitudesPendientes}
                icon={Clock}
                color="#f59e0b"
                iconBg="bg-amber-50"
              />
            </View>

            <View className="flex-row px-5 gap-3 mt-3">
              <StatsCard
                title="Documentos"
                value={documentos.length}
                icon={FileText}
                color="#10b981"
                iconBg="bg-emerald-50"
              />
              <StatsCard
                title="Pagos"
                value={pagos.length}
                icon={CreditCard}
                color="#8b5cf6"
                iconBg="bg-violet-50"
              />
            </View>

            <View className="px-5 mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">
                Solicitudes recientes
              </Text>
              {solicitudes.length === 0 ? (
                <EmptyState
                  icon={Home}
                  title="Sin solicitudes"
                  description="Busca una vivienda y envía tu primera solicitud."
                />
              ) : (
                <View className="gap-3">
                  {solicitudes.slice(0, 3).map((sol) => (
                    <SolicitudCard key={sol.id} solicitud={sol} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

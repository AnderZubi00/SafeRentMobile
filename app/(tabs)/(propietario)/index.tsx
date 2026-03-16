import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Home, FileText, CreditCard, Clock } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { usePropietario } from "@/context/PropietarioContext";
import { StatsCard } from "@/components/StatsCard";
import { SolicitudCard } from "@/components/SolicitudCard";
import { PropertyCard } from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/utils";

export default function PropietarioDashboard() {
  const { usuario } = useAuth();
  const { viviendas, solicitudes, pagos, solicitudesPendientes, cargando, recargar } =
    usePropietario();

  const nombre = usuario?.nombre_completo?.split(" ")[0] ?? "Propietario";
  const ingresosTotales = pagos
    .filter((p) => p.estado === "COMPLETADO")
    .reduce((sum, p) => sum + p.importe, 0);

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
            Panel del propietario
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
                title="Viviendas"
                value={viviendas.length}
                icon={Home}
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
                title="Solicitudes"
                value={solicitudes.length}
                icon={FileText}
                color="#10b981"
                iconBg="bg-emerald-50"
              />
              <StatsCard
                title="Ingresos"
                value={formatCurrency(ingresosTotales)}
                icon={CreditCard}
                color="#8b5cf6"
                iconBg="bg-violet-50"
              />
            </View>

            {solicitudesPendientes > 0 && (
              <View className="px-5 mt-6">
                <Text className="text-lg font-bold text-foreground mb-3">
                  Solicitudes pendientes
                </Text>
                <View className="gap-3">
                  {solicitudes
                    .filter((s) => s.estado === "PENDIENTE")
                    .slice(0, 3)
                    .map((sol) => (
                      <SolicitudCard
                        key={sol.id}
                        solicitud={sol}
                        showInquilino
                      />
                    ))}
                </View>
              </View>
            )}

            <View className="px-5 mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">
                Mis viviendas
              </Text>
              {viviendas.length === 0 ? (
                <EmptyState
                  icon={Home}
                  title="Sin viviendas"
                  description="Publica tu primera vivienda para empezar a recibir solicitudes."
                />
              ) : (
                <View className="gap-4">
                  {viviendas.slice(0, 3).map((v) => (
                    <PropertyCard key={v.id} vivienda={v} showStatus />
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

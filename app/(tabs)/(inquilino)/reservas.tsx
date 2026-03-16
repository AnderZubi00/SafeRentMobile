import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText } from "lucide-react-native";
import { useInquilino } from "@/context/InquilinoContext";
import { SolicitudCard } from "@/components/SolicitudCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";

export default function ReservasScreen() {
  const { solicitudes, cargando, recargar } = useInquilino();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">
          Mis Reservas
        </Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Tus solicitudes de alojamiento
        </Text>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <SolicitudCard solicitud={item}>
              {item.contrato && (
                <View className="flex-row items-center gap-2">
                  <Badge
                    variant={
                      item.contrato.firmado_propietario &&
                      item.contrato.firmado_inquilino
                        ? "success"
                        : "warning"
                    }
                  >
                    {item.contrato.firmado_propietario &&
                    item.contrato.firmado_inquilino
                      ? "Contrato firmado"
                      : "Contrato pendiente"}
                  </Badge>
                </View>
              )}
            </SolicitudCard>
          )}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={recargar}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={FileText}
              title="Sin reservas"
              description="Aún no has realizado ninguna solicitud de reserva."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

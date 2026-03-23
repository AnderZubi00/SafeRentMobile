import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreditCard } from "lucide-react-native";
import { usePropietario } from "@/context/PropietarioContext";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDate, estadoColor } from "@/lib/utils";
import type { PagoPropietario } from "@/lib/pagos";

function LiquidacionCard({ pago }: { pago: PagoPropietario }) {
  const estado = estadoColor(pago.estado);
  const inquilino = pago.solicitud?.inquilino?.nombre_completo ?? "Inquilino";

  return (
    <View className="bg-white rounded-2xl border border-border p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-bold text-foreground">
            {pago.concepto}
          </Text>
          <Text className="text-sm text-muted-foreground mt-0.5">
            {pago.vivienda?.titulo} · {inquilino}
          </Text>
        </View>
        <Text className="text-lg font-bold text-emerald-600">
          +{formatCurrency(pago.importe)}
        </Text>
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <Badge variant={pago.estado === "COMPLETADO" ? "success" : "warning"}>
          {estado.label}
        </Badge>
        <Text className="text-xs text-muted-foreground">
          {formatDate(pago.fecha_pago)} · {pago.metodo}
        </Text>
      </View>
    </View>
  );
}

export default function LiquidacionesScreen() {
  const { pagos, cargando, recargar } = usePropietario();

  const total = pagos
    .filter((p) => p.estado === "COMPLETADO")
    .reduce((sum, p) => sum + p.importe, 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">
          Liquidaciones
        </Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Total recibido: {formatCurrency(total)}
        </Text>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      ) : (
        <FlatList
          data={pagos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => <LiquidacionCard pago={item} />}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={recargar}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={CreditCard}
              title="Sin liquidaciones"
              description="Aquí verás los pagos recibidos de tus inquilinos."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

import { View, Text, FlatList, RefreshControl, Linking, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, ExternalLink } from "lucide-react-native";
import { usePropietario } from "@/store/propietarioStore";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";
import type { SolicitudConContrato } from "@/store/propietarioStore";

function ContratoCard({ solicitud }: { solicitud: SolicitudConContrato }) {
  const contrato = solicitud.contrato;
  if (!contrato) return null;

  const firmadoAmbos =
    contrato.firmado_propietario && contrato.firmado_inquilino;
  const pdfUrl = contrato.pdf_final_url ?? contrato.pdf_borrador_url;

  return (
    <View className="bg-white rounded-2xl border border-border p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {solicitud.viviendas?.titulo ?? "Vivienda"}
          </Text>
          <Text className="text-sm text-muted-foreground mt-0.5">
            {solicitud.usuarios?.nombre_completo ?? "Inquilino"}
          </Text>
        </View>
        <Badge variant={firmadoAmbos ? "success" : "warning"}>
          {firmadoAmbos ? "Firmado" : "Pendiente de firma"}
        </Badge>
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <View className="flex-row gap-4">
          <View>
            <Text className="text-xs text-muted-foreground">Propietario</Text>
            <Text className="text-sm font-medium text-foreground">
              {contrato.firmado_propietario ? "Firmado" : "Pendiente"}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground">Inquilino</Text>
            <Text className="text-sm font-medium text-foreground">
              {contrato.firmado_inquilino ? "Firmado" : "Pendiente"}
            </Text>
          </View>
        </View>

        {pdfUrl && (
          <TouchableOpacity
            onPress={() => Linking.openURL(pdfUrl)}
            className="flex-row items-center"
          >
            <Text className="text-sm text-primary font-medium mr-1">
              Ver PDF
            </Text>
            <ExternalLink size={14} color="#6366f1" />
          </TouchableOpacity>
        )}
      </View>

      {contrato.fecha_firma_completa && (
        <Text className="text-xs text-muted-foreground mt-2">
          Firmado el {formatDate(contrato.fecha_firma_completa)}
        </Text>
      )}
    </View>
  );
}

export default function ContratosScreen() {
  const { solicitudes, cargando, recargar } = usePropietario();
  const conContrato = solicitudes.filter((s) => s.contrato);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Contratos</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Contratos digitales de tus viviendas
        </Text>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </View>
      ) : (
        <FlatList
          data={conContrato}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => <ContratoCard solicitud={item} />}
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
              title="Sin contratos"
              description="Los contratos se generan cuando aceptas una solicitud."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

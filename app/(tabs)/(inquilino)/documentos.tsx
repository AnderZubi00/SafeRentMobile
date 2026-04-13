import { View, Text, FlatList, RefreshControl, Linking, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, ExternalLink, File, Shield, BookOpen } from "lucide-react-native";
import { useInquilino } from "@/store/inquilinoStore";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";
import type { DocumentoInquilino } from "@/store/inquilinoStore";

const tipoIcono = {
  identidad: Shield,
  temporalidad: BookOpen,
  contrato: FileText,
};

const estadoBadge: Record<string, { variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
  verificado: { variant: "success", label: "Verificado" },
  firmado: { variant: "success", label: "Firmado" },
  pendiente: { variant: "warning", label: "Pendiente" },
  rechazado: { variant: "destructive", label: "Rechazado" },
};

function DocumentoCard({ doc }: { doc: DocumentoInquilino }) {
  const Icono = tipoIcono[doc.tipo] ?? File;
  const badge = estadoBadge[doc.estado] ?? estadoBadge.pendiente;

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(doc.url)}
      activeOpacity={0.7}
      className="bg-white rounded-2xl border border-border p-4"
    >
      <View className="flex-row items-start">
        <View className="w-10 h-10 rounded-xl bg-slate-50 items-center justify-center mr-3">
          <Icono size={18} color="#6366f1" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-foreground" numberOfLines={2}>
            {doc.nombre}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {doc.viviendaTitulo} · {doc.viviendaCiudad}
          </Text>
          <View className="flex-row items-center mt-2 gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Text className="text-xs text-muted-foreground">
              {formatDate(doc.fecha)}
            </Text>
          </View>
        </View>
        <ExternalLink size={16} color="#94a3b8" />
      </View>
    </TouchableOpacity>
  );
}

export default function DocumentosScreen() {
  const { documentos, cargando, recargar } = useInquilino();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Documentos</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Identidad, justificantes y contratos
        </Text>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      ) : (
        <FlatList
          data={documentos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => <DocumentoCard doc={item} />}
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
              title="Sin documentos"
              description="Los documentos aparecerán aquí cuando envíes una solicitud."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

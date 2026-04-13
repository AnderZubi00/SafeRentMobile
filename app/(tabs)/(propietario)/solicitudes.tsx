import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, X } from "lucide-react-native";
import { usePropietario } from "@/store/propietarioStore";
import { SolicitudCard } from "@/components/SolicitudCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  aceptarSolicitud,
  rechazarSolicitud,
} from "@/lib/solicitudes";

export default function SolicitudesScreen() {
  const { solicitudes, cargando, recargar } = usePropietario();
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAceptar(id: string) {
    Alert.alert("Aceptar solicitud", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aceptar",
        onPress: async () => {
          setLoading(true);
          const { error } = await aceptarSolicitud(id);
          if (error) Alert.alert("Error", error);
          else await recargar();
          setLoading(false);
        },
      },
    ]);
  }

  async function handleRechazar() {
    if (!rechazandoId || !motivoRechazo.trim()) {
      Alert.alert("Error", "Indica un motivo de rechazo");
      return;
    }

    setLoading(true);
    const { error } = await rechazarSolicitud(rechazandoId, motivoRechazo.trim());
    if (error) Alert.alert("Error", error);
    else await recargar();
    setRechazandoId(null);
    setMotivoRechazo("");
    setLoading(false);
  }

  const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE");
  const resto = solicitudes.filter((s) => s.estado !== "PENDIENTE");

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Solicitudes</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          {pendientes.length} pendientes · {solicitudes.length} total
        </Text>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </View>
      ) : (
        <FlatList
          data={[...pendientes, ...resto]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <SolicitudCard solicitud={item} showInquilino>
              {item.estado === "PENDIENTE" && (
                <View className="flex-row gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => {
                      setRechazandoId(item.id);
                      setMotivoRechazo("");
                    }}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    loading={loading}
                    onPress={() => handleAceptar(item.id)}
                  >
                    Aceptar
                  </Button>
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
              title="Sin solicitudes"
              description="Las solicitudes de tus viviendas aparecerán aquí."
            />
          }
        />
      )}

      <Modal visible={!!rechazandoId} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">
                Rechazar solicitud
              </Text>
              <TouchableOpacity onPress={() => setRechazandoId(null)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-muted-foreground mb-3">
              Indica el motivo del rechazo
            </Text>
            <TextInput
              className="border border-input rounded-xl px-4 py-3 text-base text-foreground bg-white h-24 mb-4"
              placeholder="Motivo de rechazo..."
              placeholderTextColor="#94a3b8"
              value={motivoRechazo}
              onChangeText={setMotivoRechazo}
              multiline
              textAlignVertical="top"
            />
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setRechazandoId(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                loading={loading}
                onPress={handleRechazar}
              >
                Rechazar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

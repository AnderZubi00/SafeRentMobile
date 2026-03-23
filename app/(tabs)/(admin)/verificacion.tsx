import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, ShieldX } from "lucide-react-native";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface UsuarioKYC {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  verificado_kyc: boolean;
  dni_nie: string | null;
}

export default function VerificacionScreen() {
  const [usuarios, setUsuarios] = useState<UsuarioKYC[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.get<UsuarioKYC[]>("/admin/propietarios");
      setUsuarios(data);
    } catch (err) {
      console.error("Error cargando propietarios:", err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function toggleVerificacion(id: string, actual: boolean) {
    const accion = actual ? "revocar" : "verificar";
    Alert.alert(
      `${actual ? "Revocar" : "Verificar"} KYC`,
      `¿Seguro que quieres ${accion} este propietario?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: actual ? "Revocar" : "Verificar",
          onPress: async () => {
            try {
              await api.patch(`/admin/usuarios/${id}/kyc`, {});
              await cargar();
            } catch (err) {
              console.error("Error toggling KYC:", err);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">
          Verificación KYC
        </Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Gestiona la verificación de propietarios
        </Text>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </View>
      ) : (
        <FlatList
          data={usuarios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl border border-border p-4">
              <View className="flex-row items-center">
                <Avatar name={item.nombre_completo} />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-bold text-foreground">
                    {item.nombre_completo}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {item.email}
                  </Text>
                </View>
                <Badge
                  variant={item.verificado_kyc ? "success" : "warning"}
                >
                  {item.verificado_kyc ? "Verificado" : "Pendiente"}
                </Badge>
              </View>
              <View className="mt-3 pt-3 border-t border-slate-100">
                <Button
                  variant={item.verificado_kyc ? "outline" : "default"}
                  size="sm"
                  onPress={() =>
                    toggleVerificacion(item.id, item.verificado_kyc)
                  }
                >
                  <View className="flex-row items-center">
                    {item.verificado_kyc ? (
                      <ShieldX size={16} color="#64748b" />
                    ) : (
                      <ShieldCheck size={16} color="#fff" />
                    )}
                    <Text
                      className={`ml-2 font-semibold text-sm ${
                        item.verificado_kyc ? "text-foreground" : "text-white"
                      }`}
                    >
                      {item.verificado_kyc
                        ? "Revocar verificación"
                        : "Verificar KYC"}
                    </Text>
                  </View>
                </Button>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={cargar}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={ShieldCheck}
              title="Sin propietarios"
              description="No hay propietarios registrados todavía."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

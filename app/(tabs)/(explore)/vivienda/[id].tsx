import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Calendar,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { obtenerViviendaById, type Vivienda } from "@/lib/viviendas";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/store/authStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ViviendaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuth();
  const [vivienda, setVivienda] = useState<Vivienda | null>(null);
  const [loading, setLoading] = useState(true);
  const [fotoIndex, setFotoIndex] = useState(0);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await obtenerViviendaById(id);
      setVivienda(data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!vivienda) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-muted-foreground">
          Vivienda no encontrada
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          Volver
        </Button>
      </SafeAreaView>
    );
  }

  const fotos = vivienda.fotos ?? [];

  function handleReservar() {
    if (!usuario) {
      router.push("/(auth)/login");
      return;
    }
    Alert.alert(
      "Reservar",
      "La funcionalidad de reserva completa estará disponible próximamente. Por ahora puedes gestionar solicitudes desde la versión web."
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="h-72 bg-slate-100">
        {fotos.length > 0 ? (
          <>
            <Image
              source={{ uri: fotos[fotoIndex] }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {fotos.length > 1 && (
              <>
                <TouchableOpacity
                  onPress={() =>
                    setFotoIndex((i) => (i > 0 ? i - 1 : fotos.length - 1))
                  }
                  className="absolute left-3 top-1/2 -mt-5 w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <ChevronLeft size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setFotoIndex((i) => (i < fotos.length - 1 ? i + 1 : 0))
                  }
                  className="absolute right-3 top-1/2 -mt-5 w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <ChevronRight size={20} color="#fff" />
                </TouchableOpacity>
                <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
                  {fotos.map((_, i) => (
                    <View
                      key={i}
                      className={`w-2 h-2 rounded-full ${i === fotoIndex ? "bg-white" : "bg-white/50"}`}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-slate-400">Sin fotos</Text>
          </View>
        )}

        <SafeAreaView
          edges={["top"]}
          className="absolute top-0 left-0 right-0"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="m-4 w-10 h-10 rounded-full bg-black/30 items-center justify-center"
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-5 pt-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-xl font-bold text-foreground">
                {vivienda.titulo}
              </Text>
              <View className="flex-row items-center mt-1">
                <MapPin size={14} color="#64748b" />
                <Text className="text-sm text-muted-foreground ml-1">
                  {vivienda.direccion}, {vivienda.ciudad}
                </Text>
              </View>
            </View>
            {vivienda.verificada && (
              <Badge variant="success">
                <View className="flex-row items-center">
                  <Shield size={12} color="#059669" />
                  <Text className="text-xs font-semibold text-emerald-700 ml-1">
                    Verificada
                  </Text>
                </View>
              </Badge>
            )}
          </View>

          <View className="flex-row mt-5 gap-1">
            <View className="flex-1 bg-slate-50 rounded-xl p-3 items-center">
              <Bed size={20} color="#6366f1" />
              <Text className="text-sm font-bold text-foreground mt-1">
                {vivienda.habitaciones}
              </Text>
              <Text className="text-xs text-muted-foreground">Hab.</Text>
            </View>
            <View className="flex-1 bg-slate-50 rounded-xl p-3 items-center">
              <Bath size={20} color="#6366f1" />
              <Text className="text-sm font-bold text-foreground mt-1">
                {vivienda.banos}
              </Text>
              <Text className="text-xs text-muted-foreground">Baños</Text>
            </View>
            <View className="flex-1 bg-slate-50 rounded-xl p-3 items-center">
              <Maximize size={20} color="#6366f1" />
              <Text className="text-sm font-bold text-foreground mt-1">
                {vivienda.m2}
              </Text>
              <Text className="text-xs text-muted-foreground">m²</Text>
            </View>
            <View className="flex-1 bg-slate-50 rounded-xl p-3 items-center">
              <Calendar size={20} color="#6366f1" />
              <Text className="text-sm font-bold text-foreground mt-1">
                {vivienda.estancia_minima}
              </Text>
              <Text className="text-xs text-muted-foreground">Min. meses</Text>
            </View>
          </View>

          {vivienda.motivos?.length > 0 && (
            <View className="mt-5">
              <Text className="text-sm font-semibold text-foreground mb-2">
                Motivos aceptados
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {vivienda.motivos.map((m) => (
                  <Badge key={m} variant="secondary">
                    {m}
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {vivienda.descripcion && (
            <View className="mt-5">
              <Text className="text-sm font-semibold text-foreground mb-2">
                Descripción
              </Text>
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {vivienda.descripcion}
              </Text>
            </View>
          )}

          <View className="mt-5 bg-slate-50 rounded-2xl p-4">
            <Text className="text-sm text-muted-foreground">Precio mensual</Text>
            <Text className="text-3xl font-bold text-primary mt-1">
              {formatCurrency(vivienda.precio_mes)}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Fianza: {formatCurrency(vivienda.fianza_importe)}
            </Text>
            {vivienda.disponible_desde && (
              <Text className="text-sm text-muted-foreground mt-1">
                Disponible desde: {formatDate(vivienda.disponible_desde)}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 py-4">
        <SafeAreaView edges={["bottom"]}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-primary">
                {formatCurrency(vivienda.precio_mes)}
              </Text>
              <Text className="text-xs text-muted-foreground">/mes</Text>
            </View>
            <Button className="px-8" onPress={handleReservar}>
              Reservar
            </Button>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

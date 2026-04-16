import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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
  X,
} from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { obtenerViviendaById, obtenerDisponibilidad, type Vivienda, type Disponibilidad } from "@/lib/viviendas";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

export default function ViviendaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [vivienda, setVivienda] = useState<Vivienda | null>(null);
  const [loading, setLoading] = useState(true);
  const [fotoIndex, setFotoIndex] = useState(0);

  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [conflicto, setConflicto] = useState<string | null>(null);

  // Estado del bottom sheet de fechas
  const [modalFechas, setModalFechas] = useState(false);
  const [pickingEntrada, setPickingEntrada] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [fechaEntrada, setFechaEntrada] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [fechaSalida, setFechaSalida] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d;
  });

  useEffect(() => {
    if (!id) return;
    obtenerViviendaById(id).then(({ data }) => {
      setVivienda(data);
      setLoading(false);
    });
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
        <Text className="text-lg text-muted-foreground">Vivienda no encontrada</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>Volver</Button>
      </SafeAreaView>
    );
  }

  const fotos = vivienda.fotos ?? [];
  const mesesEstancia = Math.max(
    1,
    Math.round((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  const estanciaValida =
    mesesEstancia >= (vivienda.estancia_minima ?? 1) &&
    (!vivienda.estancia_maxima || mesesEstancia <= (vivienda.estancia_maxima as number));

  function handleReservar() {
    if (!usuario) { router.push("/(auth)/login"); return; }
    if (usuario.rol !== "INQUILINO") return;
    obtenerDisponibilidad(id!).then(({ data }) => setDisponibilidad(data));
    setConflicto(null);
    setPickingEntrada(true);
    setShowPicker(Platform.OS === "ios");
    setModalFechas(true);
  }

  function onChangeFecha(_: unknown, selected?: Date) {
    if (!selected) return;
    setConflicto(null);
    if (pickingEntrada) {
      setFechaEntrada(selected);
      if (selected >= fechaSalida) {
        const nueva = new Date(selected);
        nueva.setMonth(nueva.getMonth() + Math.max(1, vivienda?.estancia_minima ?? 1));
        setFechaSalida(nueva);
      }
    } else {
      setFechaSalida(selected);
    }
    if (Platform.OS === "android") setShowPicker(false);
  }

  function confirmarFechas() {
    if (!estanciaValida) return;

    if (disponibilidad?.disponible_desde) {
      const dispDesde = new Date(disponibilidad.disponible_desde);
      if (fechaEntrada < dispDesde) {
        setConflicto(`Disponible desde ${formatDate(disponibilidad.disponible_desde)}`);
        return;
      }
    }

    const rangos = [
      ...(disponibilidad?.ocupaciones ?? []).map((o) => ({
        inicio: new Date(o.fecha_entrada),
        fin: new Date(o.fecha_salida),
      })),
      ...(disponibilidad?.bloqueos ?? []).map((b) => ({
        inicio: new Date(b.fecha_inicio),
        fin: new Date(b.fecha_fin),
      })),
    ];

    if (rangos.some(({ inicio, fin }) => fechaEntrada < fin && fechaSalida > inicio)) {
      setConflicto("Las fechas seleccionadas no están disponibles");
      return;
    }

    setModalFechas(false);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    router.push({
      pathname: "/(tabs)/(inquilino)/checkout",
      params: {
        vivienda_id: vivienda!.id,
        propietario_id: vivienda!.propietario_id,
        entrada: fmt(fechaEntrada),
        salida: fmt(fechaSalida),
      },
    });
  }

  return (
    <View className="flex-1 bg-white">
      {/* Galería */}
      <View className="h-72 bg-slate-100">
        {fotos.length > 0 ? (
          <>
            <Image source={{ uri: fotos[fotoIndex] }} className="w-full h-full" resizeMode="cover" />
            {fotos.length > 1 && (
              <>
                <TouchableOpacity
                  onPress={() => setFotoIndex((i) => (i > 0 ? i - 1 : fotos.length - 1))}
                  className="absolute left-3 top-1/2 -mt-5 w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <ChevronLeft size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFotoIndex((i) => (i < fotos.length - 1 ? i + 1 : 0))}
                  className="absolute right-3 top-1/2 -mt-5 w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <ChevronRight size={20} color="#fff" />
                </TouchableOpacity>
                <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
                  {fotos.map((_, i) => (
                    <View key={i} className={`w-2 h-2 rounded-full ${i === fotoIndex ? "bg-white" : "bg-white/50"}`} />
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
        <SafeAreaView edges={["top"]} className="absolute top-0 left-0 right-0">
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
          {/* Título e insignia */}
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-xl font-bold text-foreground">{vivienda.titulo}</Text>
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
                  <Text className="text-xs font-semibold text-emerald-700 ml-1">Verificada</Text>
                </View>
              </Badge>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row mt-5 gap-1">
            {[
              { icon: Bed, label: "Hab.", value: vivienda.habitaciones },
              { icon: Bath, label: "Baños", value: vivienda.banos },
              { icon: Maximize, label: "m²", value: vivienda.m2 },
              { icon: Calendar, label: "Min. meses", value: vivienda.estancia_minima },
            ].map(({ icon: Icon, label, value }) => (
              <View key={label} className="flex-1 bg-slate-50 rounded-xl p-3 items-center">
                <Icon size={20} color="#6366f1" />
                <Text className="text-sm font-bold text-foreground mt-1">{value}</Text>
                <Text className="text-xs text-muted-foreground">{label}</Text>
              </View>
            ))}
          </View>

          {/* Motivos */}
          {vivienda.motivos?.length > 0 && (
            <View className="mt-5">
              <Text className="text-sm font-semibold text-foreground mb-2">Motivos aceptados</Text>
              <View className="flex-row flex-wrap gap-2">
                {vivienda.motivos.map((m) => <Badge key={m} variant="secondary">{m}</Badge>)}
              </View>
            </View>
          )}

          {/* Descripción */}
          {vivienda.descripcion && (
            <View className="mt-5">
              <Text className="text-sm font-semibold text-foreground mb-2">Descripción</Text>
              <Text className="text-sm text-muted-foreground leading-relaxed">{vivienda.descripcion}</Text>
            </View>
          )}

          {/* Precio */}
          <View className="mt-5 bg-slate-50 rounded-2xl p-4">
            <Text className="text-sm text-muted-foreground">Precio mensual</Text>
            <Text className="text-3xl font-bold text-primary mt-1">{formatCurrency(vivienda.precio_mes)}</Text>
            <Text className="text-sm text-muted-foreground mt-1">Fianza: {formatCurrency(vivienda.fianza_importe)}</Text>
            {vivienda.disponible_desde && (
              <Text className="text-sm text-muted-foreground mt-1">
                Disponible desde: {formatDate(vivienda.disponible_desde)}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Barra inferior */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 py-4">
        <SafeAreaView edges={["bottom"]}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-primary">{formatCurrency(vivienda.precio_mes)}</Text>
              <Text className="text-xs text-muted-foreground">/mes</Text>
            </View>
            {usuario?.rol === "INQUILINO" ? (
              <Button className="px-8" onPress={handleReservar}>Reservar</Button>
            ) : !usuario ? (
              <Button variant="outline" className="px-8" onPress={() => router.push("/(auth)/login")}>
                Iniciar sesión
              </Button>
            ) : null}
          </View>
        </SafeAreaView>
      </View>

      {/* Modal selector de fechas */}
      <Modal visible={modalFechas} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl">
            <SafeAreaView edges={["bottom"]}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
                <Text className="text-xl font-bold text-slate-900">Selecciona las fechas</Text>
                <TouchableOpacity onPress={() => setModalFechas(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Chips entrada/salida */}
              <View className="flex-row px-6 gap-3 mb-4">
                <Pressable
                  onPress={() => { setPickingEntrada(true); setShowPicker(true); }}
                  className={`flex-1 rounded-xl p-3 border-2 ${pickingEntrada ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}
                >
                  <Text className={`text-xs font-medium mb-1 ${pickingEntrada ? "text-indigo-600" : "text-slate-500"}`}>Entrada</Text>
                  <Text className={`text-sm font-bold ${pickingEntrada ? "text-indigo-800" : "text-slate-800"}`}>
                    {formatDate(fechaEntrada.toISOString())}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setPickingEntrada(false); setShowPicker(true); }}
                  className={`flex-1 rounded-xl p-3 border-2 ${!pickingEntrada ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}
                >
                  <Text className={`text-xs font-medium mb-1 ${!pickingEntrada ? "text-indigo-600" : "text-slate-500"}`}>Salida</Text>
                  <Text className={`text-sm font-bold ${!pickingEntrada ? "text-indigo-800" : "text-slate-800"}`}>
                    {formatDate(fechaSalida.toISOString())}
                  </Text>
                </Pressable>
              </View>

              {/* DateTimePicker */}
              {(showPicker || Platform.OS === "ios") && (
                <DateTimePicker
                  value={pickingEntrada ? fechaEntrada : fechaSalida}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={pickingEntrada ? new Date() : fechaEntrada}
                  onChange={onChangeFecha}
                  style={{ alignSelf: "center" }}
                />
              )}

              {/* Duración */}
              <View className="mx-6 mb-4">
                <View className={`rounded-xl px-4 py-3 ${estanciaValida ? "bg-indigo-50" : "bg-rose-50"}`}>
                  <Text className={`text-sm font-medium text-center ${estanciaValida ? "text-indigo-700" : "text-rose-600"}`}>
                    {mesesEstancia} {mesesEstancia === 1 ? "mes" : "meses"} de estancia
                    {!estanciaValida && ` · mínimo ${vivienda.estancia_minima} ${vivienda.estancia_minima === 1 ? "mes" : "meses"}`}
                  </Text>
                </View>
              </View>

              {/* Error de disponibilidad */}
              {conflicto && (
                <View className="mx-6 mb-3 bg-rose-50 rounded-xl px-4 py-3">
                  <Text className="text-sm text-rose-600 text-center">{conflicto}</Text>
                </View>
              )}

              {/* Confirmar */}
              <View className="px-6 pb-4">
                <Pressable
                  onPress={confirmarFechas}
                  disabled={!estanciaValida}
                  className={`rounded-2xl py-4 items-center ${estanciaValida ? "bg-indigo-500 active:bg-indigo-600" : "bg-slate-200"}`}
                >
                  <Text className={`text-base font-semibold ${estanciaValida ? "text-white" : "text-slate-400"}`}>
                    Continuar con la reserva
                  </Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

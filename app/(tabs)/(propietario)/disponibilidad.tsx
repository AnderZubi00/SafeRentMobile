import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  Platform,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarX, Plus, Trash2, X } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { usePropietario } from "@/store/propietarioStore";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";
import {
  obtenerDisponibilidad,
  crearBloqueo,
  eliminarBloqueo,
  type Disponibilidad,
  type BloqueoFecha,
} from "@/lib/viviendas";

interface EstadoBloqueos {
  [viviendaId: string]: Disponibilidad | null;
}

export default function DisponibilidadScreen() {
  const { viviendas, recargar } = usePropietario();
  const [cargando, setCargando] = useState(false);
  const [bloqueosPorVivienda, setBloqueosPorVivienda] = useState<EstadoBloqueos>({});
  const [viviendaExpandida, setViviendaExpandida] = useState<string | null>(null);

  // Modal nuevo bloqueo
  const [modalVisible, setModalVisible] = useState(false);
  const [viviendaSeleccionada, setViviendaSeleccionada] = useState<string | null>(null);
  const [pickingInicio, setPickingInicio] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [fechaFin, setFechaFin] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  });
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarBloqueos(viviendaId: string) {
    setCargando(true);
    const { data } = await obtenerDisponibilidad(viviendaId);
    setBloqueosPorVivienda((prev) => ({ ...prev, [viviendaId]: data }));
    setCargando(false);
  }

  function toggleVivienda(viviendaId: string) {
    if (viviendaExpandida === viviendaId) {
      setViviendaExpandida(null);
    } else {
      setViviendaExpandida(viviendaId);
      if (!bloqueosPorVivienda[viviendaId]) {
        cargarBloqueos(viviendaId);
      }
    }
  }

  function abrirModalBloqueo(viviendaId: string) {
    setViviendaSeleccionada(viviendaId);
    setFechaInicio(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; });
    setFechaFin(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; });
    setMotivo("");
    setError(null);
    setPickingInicio(true);
    setShowPicker(Platform.OS === "ios");
    setModalVisible(true);
  }

  function onChangeFecha(_: unknown, selected?: Date) {
    if (!selected) return;
    setError(null);
    if (pickingInicio) {
      setFechaInicio(selected);
      if (selected >= fechaFin) {
        const nueva = new Date(selected);
        nueva.setMonth(nueva.getMonth() + 1);
        setFechaFin(nueva);
      }
    } else {
      setFechaFin(selected);
    }
    if (Platform.OS === "android") setShowPicker(false);
  }

  async function confirmarBloqueo() {
    if (!viviendaSeleccionada) return;
    if (fechaInicio >= fechaFin) {
      setError("La fecha de inicio debe ser anterior a la fecha de fin");
      return;
    }
    setGuardando(true);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const { data, error: err } = await crearBloqueo(viviendaSeleccionada, {
      fecha_inicio: fmt(fechaInicio),
      fecha_fin: fmt(fechaFin),
      motivo: motivo.trim() || undefined,
    });
    setGuardando(false);
    if (err) { setError(err); return; }
    if (data) {
      setBloqueosPorVivienda((prev) => {
        const actual = prev[viviendaSeleccionada];
        if (!actual) return prev;
        return {
          ...prev,
          [viviendaSeleccionada]: {
            ...actual,
            bloqueos: [...actual.bloqueos, data].sort(
              (a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
            ),
          },
        };
      });
    }
    setModalVisible(false);
  }

  async function borrarBloqueo(viviendaId: string, bloqueo: BloqueoFecha) {
    const { error: err } = await eliminarBloqueo(viviendaId, bloqueo.id);
    if (err) return;
    setBloqueosPorVivienda((prev) => {
      const actual = prev[viviendaId];
      if (!actual) return prev;
      return {
        ...prev,
        [viviendaId]: {
          ...actual,
          bloqueos: actual.bloqueos.filter((b) => b.id !== bloqueo.id),
        },
      };
    });
  }

  const viviendasPublicadas = viviendas.filter((v) => !v.es_borrador);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={recargar} tintColor="#6366f1" />
        }
      >
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Disponibilidad</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Bloquea fechas para mantenimiento o entre inquilinos
          </Text>
        </View>

        {viviendasPublicadas.length === 0 ? (
          <View className="px-5 mt-8">
            <EmptyState
              icon={CalendarX}
              title="Sin viviendas publicadas"
              description="Publica una vivienda para gestionar su disponibilidad."
            />
          </View>
        ) : (
          <View className="px-5 mt-4 gap-3">
            {viviendasPublicadas.map((vivienda) => {
              const expandida = viviendaExpandida === vivienda.id;
              const dispData = bloqueosPorVivienda[vivienda.id];

              return (
                <View key={vivienda.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100">
                  {/* Cabecera vivienda */}
                  <TouchableOpacity
                    onPress={() => toggleVivienda(vivienda.id)}
                    className="px-4 py-4 flex-row items-center justify-between"
                    activeOpacity={0.7}
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {vivienda.titulo}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {vivienda.ciudad}
                        {dispData ? ` · ${dispData.bloqueos.length} bloqueo${dispData.bloqueos.length !== 1 ? "s" : ""}` : ""}
                      </Text>
                    </View>
                    <Text className="text-indigo-500 text-sm font-medium">
                      {expandida ? "Cerrar" : "Gestionar"}
                    </Text>
                  </TouchableOpacity>

                  {/* Contenido expandido */}
                  {expandida && (
                    <View className="border-t border-slate-100">
                      {cargando && !dispData ? (
                        <View className="py-8 items-center">
                          <ActivityIndicator color="#6366f1" />
                        </View>
                      ) : (
                        <>
                          {/* Lista de bloqueos */}
                          {dispData?.bloqueos.length === 0 && (
                            <View className="px-4 py-4">
                              <Text className="text-sm text-muted-foreground text-center">
                                Sin bloqueos activos
                              </Text>
                            </View>
                          )}
                          {dispData?.bloqueos.map((bloqueo) => (
                            <View
                              key={bloqueo.id}
                              className="flex-row items-center justify-between px-4 py-3 border-b border-slate-50"
                            >
                              <View className="flex-1 mr-3">
                                <Text className="text-sm font-medium text-foreground">
                                  {formatDate(bloqueo.fecha_inicio)} → {formatDate(bloqueo.fecha_fin)}
                                </Text>
                                {bloqueo.motivo && (
                                  <Text className="text-xs text-muted-foreground mt-0.5">
                                    {bloqueo.motivo}
                                  </Text>
                                )}
                              </View>
                              <TouchableOpacity
                                onPress={() => borrarBloqueo(vivienda.id, bloqueo)}
                                className="w-8 h-8 items-center justify-center rounded-full bg-rose-50"
                              >
                                <Trash2 size={15} color="#e11d48" />
                              </TouchableOpacity>
                            </View>
                          ))}

                          {/* Botón añadir */}
                          <View className="px-4 py-3">
                            <Button
                              variant="outline"
                              onPress={() => abrirModalBloqueo(vivienda.id)}
                              className="flex-row items-center gap-2"
                            >
                              <Plus size={16} color="#6366f1" />
                              <Text className="text-indigo-600 font-medium text-sm">
                                Añadir bloqueo
                              </Text>
                            </Button>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal nuevo bloqueo */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl">
            <SafeAreaView edges={["bottom"]}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
                <Text className="text-xl font-bold text-slate-900">Nuevo bloqueo</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Chips fecha inicio/fin */}
              <View className="flex-row px-6 gap-3 mb-4">
                <Pressable
                  onPress={() => { setPickingInicio(true); setShowPicker(true); }}
                  className={`flex-1 rounded-xl p-3 border-2 ${pickingInicio ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}
                >
                  <Text className={`text-xs font-medium mb-1 ${pickingInicio ? "text-indigo-600" : "text-slate-500"}`}>
                    Inicio
                  </Text>
                  <Text className={`text-sm font-bold ${pickingInicio ? "text-indigo-800" : "text-slate-800"}`}>
                    {formatDate(fechaInicio.toISOString())}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setPickingInicio(false); setShowPicker(true); }}
                  className={`flex-1 rounded-xl p-3 border-2 ${!pickingInicio ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}
                >
                  <Text className={`text-xs font-medium mb-1 ${!pickingInicio ? "text-indigo-600" : "text-slate-500"}`}>
                    Fin
                  </Text>
                  <Text className={`text-sm font-bold ${!pickingInicio ? "text-indigo-800" : "text-slate-800"}`}>
                    {formatDate(fechaFin.toISOString())}
                  </Text>
                </Pressable>
              </View>

              {/* DateTimePicker */}
              {(showPicker || Platform.OS === "ios") && (
                <DateTimePicker
                  value={pickingInicio ? fechaInicio : fechaFin}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={pickingInicio ? new Date() : fechaInicio}
                  onChange={onChangeFecha}
                  style={{ alignSelf: "center" }}
                />
              )}

              {/* Error */}
              {error && (
                <View className="mx-6 mb-3 bg-rose-50 rounded-xl px-4 py-3">
                  <Text className="text-sm text-rose-600 text-center">{error}</Text>
                </View>
              )}

              {/* Confirmar */}
              <View className="px-6 pb-4">
                <Pressable
                  onPress={confirmarBloqueo}
                  disabled={guardando}
                  className={`rounded-2xl py-4 items-center ${guardando ? "bg-slate-200" : "bg-indigo-500 active:bg-indigo-600"}`}
                >
                  {guardando ? (
                    <ActivityIndicator color="#6366f1" />
                  ) : (
                    <Text className="text-base font-semibold text-white">
                      Confirmar bloqueo
                    </Text>
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PropertyCard } from "@/components/PropertyCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { obtenerViviendas, type Vivienda, type FiltrosVivienda } from "@/lib/viviendas";

const MOTIVOS = [
  { label: "Todos", value: "todos" },
  { label: "Estudios", value: "Estudios" },
  { label: "Trabajo", value: "Trabajo" },
  { label: "Obras", value: "Obras" },
  { label: "Salud", value: "Salud" },
  { label: "Otros", value: "Otros" },
];

export default function ExploreScreen() {
  const [viviendas, setViviendas] = useState<Vivienda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const [ciudad, setCiudad] = useState("");
  const [motivo, setMotivo] = useState("todos");
  const [precioMax, setPrecioMax] = useState("");
  const [habitaciones, setHabitaciones] = useState("");

  const cargar = useCallback(
    async (pullToRefresh = false) => {
      if (pullToRefresh) setRefreshing(true);
      else setCargando(true);

      const filtros: FiltrosVivienda = {};
      if (ciudad.trim()) filtros.ciudad = ciudad.trim();
      if (motivo !== "todos") filtros.motivo = motivo;
      if (precioMax) filtros.precioMax = parseInt(precioMax, 10);
      if (habitaciones) filtros.habitaciones = parseInt(habitaciones, 10);

      const { data } = await obtenerViviendas(filtros);
      setViviendas(data);

      setCargando(false);
      setRefreshing(false);
    },
    [ciudad, motivo, precioMax, habitaciones]
  );

  useEffect(() => {
    cargar();
  }, []);

  function aplicarFiltros() {
    setFiltersVisible(false);
    cargar();
  }

  function limpiarFiltros() {
    setCiudad("");
    setMotivo("todos");
    setPrecioMax("");
    setHabitaciones("");
    setFiltersVisible(false);
    setTimeout(() => cargar(), 100);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">
          Buscar alojamiento
        </Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Encuentra tu vivienda temporal ideal
        </Text>
      </View>

      <View className="px-5 pb-3 flex-row gap-3">
        <View className="flex-1 flex-row items-center bg-white rounded-xl border border-border px-4">
          <Search size={18} color="#94a3b8" />
          <Input
            placeholder="Ciudad..."
            value={ciudad}
            onChangeText={setCiudad}
            onSubmitEditing={() => cargar()}
            returnKeyType="search"
            className="flex-1 ml-2 border-0 bg-transparent p-0 py-3"
          />
        </View>
        <TouchableOpacity
          onPress={() => setFiltersVisible(true)}
          className="w-12 h-12 bg-white rounded-xl border border-border items-center justify-center"
        >
          <SlidersHorizontal size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </View>
      ) : (
        <FlatList
          data={viviendas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-4" />}
          renderItem={({ item }) => <PropertyCard vivienda={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => cargar(true)}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={Search}
              title="Sin resultados"
              description="No se encontraron viviendas con los filtros seleccionados."
            >
              <Button variant="outline" size="sm" onPress={limpiarFiltros}>
                Limpiar filtros
              </Button>
            </EmptyState>
          }
        />
      )}

      <Modal visible={filtersVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Filtros</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Select
              label="Motivo de estancia"
              options={MOTIVOS}
              value={motivo}
              onValueChange={setMotivo}
              className="mb-4"
            />

            <Input
              label="Precio máximo (€/mes)"
              placeholder="Ej: 800"
              value={precioMax}
              onChangeText={setPrecioMax}
              keyboardType="numeric"
              containerClassName="mb-4"
            />

            <Input
              label="Habitaciones mínimas"
              placeholder="Ej: 2"
              value={habitaciones}
              onChangeText={setHabitaciones}
              keyboardType="numeric"
              containerClassName="mb-6"
            />

            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={limpiarFiltros}
              >
                Limpiar
              </Button>
              <Button className="flex-1" onPress={aplicarFiltros}>
                Aplicar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

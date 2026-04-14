import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Switch,
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
import { PROVINCIAS, getCiudadesByProvincia } from "@/lib/spain-locations";

const MOTIVOS = [
  { label: "Todos", value: "todos" },
  { label: "Estudios", value: "Estudios" },
  { label: "Trabajo temporal", value: "Trabajo temporal" },
  { label: "Obras", value: "Obras" },
  { label: "Salud", value: "Salud" },
  { label: "Otros", value: "Otros" },
];

const ORDENAR = [
  { label: "Más recientes", value: "recientes" },
  { label: "Precio: menor a mayor", value: "precio_asc" },
  { label: "Precio: mayor a menor", value: "precio_desc" },
];

const PROVINCIAS_OPTIONS = [
  { label: "Todas las provincias", value: "" },
  ...PROVINCIAS.map((p) => ({ label: p.name, value: p.name })),
];

export default function ExploreScreen() {
  const [viviendas, setViviendas] = useState<Vivienda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Filtros
  const [ciudad, setCiudad] = useState("");
  const [motivo, setMotivo] = useState("todos");
  const [precioMax, setPrecioMax] = useState("");
  const [habitaciones, setHabitaciones] = useState("");
  // Filtros adicionales (web parity)
  const [provincia, setProvincia] = useState("");
  const [ciudadSelect, setCiudadSelect] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [soloVerificadas, setSoloVerificadas] = useState(false);
  const [ordenar, setOrdenar] = useState("recientes");

  const ciudadesOptions = provincia
    ? [
        { label: "Todas las ciudades", value: "" },
        ...getCiudadesByProvincia(PROVINCIAS.find((p) => p.name === provincia)?.code ?? "").map(
          (c) => ({ label: c, value: c })
        ),
      ]
    : [];

  const cargar = useCallback(
    async (pullToRefresh = false) => {
      if (pullToRefresh) setRefreshing(true);
      else setCargando(true);

      const filtros: FiltrosVivienda & { soloVerificadas?: boolean; ordenar?: string } = {};
      const busquedaCiudad = ciudadSelect || ciudad.trim();
      if (busquedaCiudad) filtros.ciudad = busquedaCiudad;
      if (provincia) filtros.provincia = provincia;
      if (motivo !== "todos") filtros.motivo = motivo;
      if (precioMax) filtros.precioMax = parseInt(precioMax, 10);
      if (precioMin) filtros.precioMin = parseInt(precioMin, 10);
      if (habitaciones) filtros.habitaciones = parseInt(habitaciones, 10);
      if (soloVerificadas) filtros.soloVerificadas = true;
      if (ordenar !== "recientes") filtros.ordenar = ordenar;

      const { data } = await obtenerViviendas(filtros);
      setViviendas(data);

      setCargando(false);
      setRefreshing(false);
    },
    [ciudad, ciudadSelect, motivo, precioMax, precioMin, habitaciones, soloVerificadas, ordenar, provincia]
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
    setPrecioMin("");
    setHabitaciones("");
    setProvincia("");
    setCiudadSelect("");
    setSoloVerificadas(false);
    setOrdenar("recientes");
    setFiltersVisible(false);
    setTimeout(() => cargar(), 100);
  }

  const filtrosActivos =
    !!ciudad.trim() ||
    motivo !== "todos" ||
    !!precioMax ||
    !!precioMin ||
    !!habitaciones ||
    !!provincia ||
    soloVerificadas ||
    ordenar !== "recientes";

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Buscar alojamiento</Text>
        <Text className="text-sm text-muted-foreground mt-1">Encuentra tu vivienda temporal ideal</Text>
      </View>

      {/* Barra de búsqueda */}
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
          className={`w-12 h-12 rounded-xl border items-center justify-center ${filtrosActivos ? "bg-indigo-500 border-indigo-500" : "bg-white border-border"}`}
        >
          <SlidersHorizontal size={18} color={filtrosActivos ? "#ffffff" : "#64748b"} />
        </TouchableOpacity>
      </View>

      {/* Indicador de filtros activos */}
      {filtrosActivos && (
        <View className="px-5 pb-2 flex-row items-center gap-2">
          <Text className="text-xs text-indigo-600 font-medium">Filtros activos</Text>
          <TouchableOpacity onPress={limpiarFiltros}>
            <Text className="text-xs text-slate-500 underline">Limpiar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista */}
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
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor="#6366f1" />
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

      {/* Modal de filtros */}
      <Modal visible={filtersVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl">
            <SafeAreaView edges={["bottom"]}>
              <View className="p-6">
                <View className="flex-row items-center justify-between mb-5">
                  <Text className="text-xl font-bold text-foreground">Filtros</Text>
                  <TouchableOpacity onPress={() => setFiltersVisible(false)}>
                    <X size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Provincia */}
                <Select
                  label="Provincia"
                  options={PROVINCIAS_OPTIONS}
                  value={provincia}
                  onValueChange={(v) => { setProvincia(v); setCiudadSelect(""); }}
                  className="mb-4"
                />

                {/* Ciudad (cascading) */}
                {provincia ? (
                  <Select
                    label="Ciudad"
                    options={ciudadesOptions}
                    value={ciudadSelect}
                    onValueChange={setCiudadSelect}
                    className="mb-4"
                  />
                ) : null}

                {/* Motivo */}
                <Select
                  label="Motivo de estancia"
                  options={MOTIVOS}
                  value={motivo}
                  onValueChange={setMotivo}
                  className="mb-4"
                />

                {/* Precio */}
                <View className="flex-row gap-3 mb-4">
                  <Input
                    label="Precio mín. (€/mes)"
                    placeholder="Ej: 400"
                    value={precioMin}
                    onChangeText={setPrecioMin}
                    keyboardType="numeric"
                    containerClassName="flex-1"
                  />
                  <Input
                    label="Precio máx. (€/mes)"
                    placeholder="Ej: 1200"
                    value={precioMax}
                    onChangeText={setPrecioMax}
                    keyboardType="numeric"
                    containerClassName="flex-1"
                  />
                </View>

                {/* Habitaciones */}
                <Input
                  label="Habitaciones mínimas"
                  placeholder="Ej: 2"
                  value={habitaciones}
                  onChangeText={setHabitaciones}
                  keyboardType="numeric"
                  containerClassName="mb-4"
                />

                {/* Solo verificadas */}
                <View className="flex-row items-center justify-between mb-4 bg-slate-50 rounded-xl px-4 py-3">
                  <View>
                    <Text className="text-sm font-medium text-slate-800">Solo verificadas</Text>
                    <Text className="text-xs text-slate-500">Viviendas con sello SafeRent</Text>
                  </View>
                  <Switch
                    value={soloVerificadas}
                    onValueChange={setSoloVerificadas}
                    trackColor={{ false: "#e2e8f0", true: "#6366f1" }}
                    thumbColor="#ffffff"
                  />
                </View>

                {/* Ordenar */}
                <Select
                  label="Ordenar por"
                  options={ORDENAR}
                  value={ordenar}
                  onValueChange={setOrdenar}
                  className="mb-6"
                />

                {/* Botones */}
                <View className="flex-row gap-3">
                  <Button variant="outline" className="flex-1" onPress={limpiarFiltros}>
                    Limpiar
                  </Button>
                  <Button className="flex-1" onPress={aplicarFiltros}>
                    Aplicar
                  </Button>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

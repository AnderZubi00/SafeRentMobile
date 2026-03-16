import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Home, Plus } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { publicarVivienda } from "@/lib/viviendas";
import { usePropietario } from "@/context/PropietarioContext";

const MOTIVOS_OPCIONES = [
  { label: "Estudios", value: "Estudios" },
  { label: "Trabajo", value: "Trabajo" },
  { label: "Obras", value: "Obras" },
  { label: "Salud", value: "Salud" },
  { label: "Otros", value: "Otros" },
];

export default function PublicarScreen() {
  const router = useRouter();
  const { recargar } = usePropietario();
  const [loading, setLoading] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [precioMes, setPrecioMes] = useState("");
  const [fianza, setFianza] = useState("");
  const [habitaciones, setHabitaciones] = useState("");
  const [banos, setBanos] = useState("");
  const [m2, setM2] = useState("");
  const [numRegistro, setNumRegistro] = useState("");
  const [estanciaMinima, setEstanciaMinima] = useState("1");
  const [estanciaMaxima, setEstanciaMaxima] = useState("12");
  const [motivos, setMotivos] = useState<string[]>([]);

  function toggleMotivo(m: string) {
    setMotivos((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  async function handlePublicar() {
    if (!titulo || !direccion || !ciudad || !precioMes || !numRegistro) {
      Alert.alert("Error", "Completa los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const { error } = await publicarVivienda({
        titulo,
        descripcion: descripcion || undefined,
        direccion,
        barrio: barrio || undefined,
        ciudad,
        precio_mes: parseFloat(precioMes),
        fianza_importe: parseFloat(fianza || "0"),
        habitaciones: parseInt(habitaciones || "1", 10),
        banos: parseInt(banos || "1", 10),
        m2: parseInt(m2 || "0", 10),
        motivos,
        num_registro_vivienda: numRegistro,
        estancia_minima: parseInt(estanciaMinima, 10),
        estancia_maxima: parseInt(estanciaMaxima, 10),
      });

      if (error) {
        Alert.alert("Error", error);
        return;
      }

      Alert.alert("Publicada", "Tu vivienda ha sido publicada correctamente.");
      await recargar();
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 pt-4 pb-2">
            <Text className="text-2xl font-bold text-foreground">
              Publicar vivienda
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Completa los datos de tu propiedad
            </Text>
          </View>

          <View className="px-5 mt-4 gap-4">
            <Input
              label="Título *"
              placeholder="Ej: Piso luminoso en el centro"
              value={titulo}
              onChangeText={setTitulo}
            />

            <Input
              label="Descripción"
              placeholder="Describe tu vivienda..."
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={4}
              className="h-24"
              style={{ textAlignVertical: "top" }}
            />

            <Input
              label="Dirección *"
              placeholder="Calle, número, piso"
              value={direccion}
              onChangeText={setDireccion}
            />

            <View className="flex-row gap-3">
              <Input
                label="Barrio"
                placeholder="Barrio"
                value={barrio}
                onChangeText={setBarrio}
                containerClassName="flex-1"
              />
              <Input
                label="Ciudad *"
                placeholder="Ciudad"
                value={ciudad}
                onChangeText={setCiudad}
                containerClassName="flex-1"
              />
            </View>

            <View className="flex-row gap-3">
              <Input
                label="Precio/mes (€) *"
                placeholder="800"
                value={precioMes}
                onChangeText={setPrecioMes}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
              <Input
                label="Fianza (€)"
                placeholder="800"
                value={fianza}
                onChangeText={setFianza}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
            </View>

            <View className="flex-row gap-3">
              <Input
                label="Habitaciones"
                placeholder="2"
                value={habitaciones}
                onChangeText={setHabitaciones}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
              <Input
                label="Baños"
                placeholder="1"
                value={banos}
                onChangeText={setBanos}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
              <Input
                label="m²"
                placeholder="65"
                value={m2}
                onChangeText={setM2}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
            </View>

            <Input
              label="Nº Registro vivienda *"
              placeholder="VT-XXXXX"
              value={numRegistro}
              onChangeText={setNumRegistro}
            />

            <View className="flex-row gap-3">
              <Input
                label="Estancia mín. (meses)"
                placeholder="1"
                value={estanciaMinima}
                onChangeText={setEstanciaMinima}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
              <Input
                label="Estancia máx. (meses)"
                placeholder="12"
                value={estanciaMaxima}
                onChangeText={setEstanciaMaxima}
                keyboardType="numeric"
                containerClassName="flex-1"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-foreground mb-2">
                Motivos aceptados
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {MOTIVOS_OPCIONES.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => toggleMotivo(m.value)}
                    className={`px-4 py-2 rounded-full border ${
                      motivos.includes(m.value)
                        ? "bg-primary border-primary"
                        : "bg-white border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        motivos.includes(m.value)
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View className="px-5 py-4 bg-white border-t border-border">
          <SafeAreaView edges={["bottom"]}>
            <Button onPress={handlePublicar} loading={loading}>
              <View className="flex-row items-center">
                <Plus size={18} color="#fff" />
                <Text className="text-white font-semibold text-base ml-2">
                  Publicar vivienda
                </Text>
              </View>
            </Button>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

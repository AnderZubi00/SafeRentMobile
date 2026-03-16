import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shield, ArrowLeft } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { registrarConSupabase, rutaSegunRol, type Rol } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

const roles: { value: Rol; label: string; desc: string }[] = [
  {
    value: "INQUILINO",
    label: "Inquilino",
    desc: "Busco alojamiento temporal",
  },
  {
    value: "PROPIETARIO",
    label: "Propietario",
    desc: "Quiero publicar mi vivienda",
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { setUsuario } = useAuth();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("INQUILINO");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Error", "Completa todos los campos");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const usuario = await registrarConSupabase(
        email.trim(),
        password,
        nombre.trim(),
        rol
      );
      setUsuario(usuario);
      router.replace(rutaSegunRol(usuario.rol) as any);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          className="px-6"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-6"
          >
            <ArrowLeft size={20} color="#94a3b8" />
            <Text className="text-slate-400 ml-2">Volver</Text>
          </TouchableOpacity>

          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
              <Shield size={32} color="#fff" />
            </View>
            <Text className="text-2xl font-bold text-white">
              Crear cuenta
            </Text>
          </View>

          <View className="bg-white/5 rounded-3xl p-6 border border-white/10">
            <Input
              label="Nombre completo"
              placeholder="Tu nombre"
              value={nombre}
              onChangeText={setNombre}
              className="bg-white/10 border-white/10 text-white mb-4"
              placeholderTextColor="#64748b"
            />

            <Input
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-white/10 border-white/10 text-white mb-4"
              placeholderTextColor="#64748b"
            />

            <Input
              label="Contraseña"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              className="bg-white/10 border-white/10 text-white mb-4"
              placeholderTextColor="#64748b"
            />

            <Text className="text-sm font-medium text-white mb-3">
              ¿Qué rol necesitas?
            </Text>
            <View className="flex-row gap-3 mb-6">
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRol(r.value)}
                  className={`flex-1 p-4 rounded-2xl border ${
                    rol === r.value
                      ? "border-primary bg-primary/20"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      rol === r.value ? "text-primary" : "text-white"
                    }`}
                  >
                    {r.label}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-1">{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button onPress={handleRegister} loading={loading}>
              Crear cuenta
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

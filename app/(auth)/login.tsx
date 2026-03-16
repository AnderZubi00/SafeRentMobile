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
import { Shield, Mail, Lock } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginConSupabase, rutaSegunRol } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { setUsuario } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Introduce tu email y contraseña");
      return;
    }

    setLoading(true);
    try {
      const usuario = await loginConSupabase(email.trim(), password);
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
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
              <Shield size={32} color="#fff" />
            </View>
            <Text className="text-3xl font-bold text-white">saferent</Text>
            <Text className="text-base text-slate-400 mt-2">
              Alquila con total seguridad
            </Text>
          </View>

          <View className="bg-white/5 rounded-3xl p-6 border border-white/10">
            <Text className="text-xl font-bold text-white mb-6">
              Iniciar sesión
            </Text>

            <View className="flex-row items-center bg-white/10 rounded-xl px-4 py-3 mb-4">
              <Mail size={18} color="#94a3b8" />
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                className="flex-1 ml-3 border-0 bg-transparent text-white p-0"
                placeholderTextColor="#64748b"
              />
            </View>

            <View className="flex-row items-center bg-white/10 rounded-xl px-4 py-3 mb-6">
              <Lock size={18} color="#94a3b8" />
              <Input
                placeholder="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                className="flex-1 ml-3 border-0 bg-transparent text-white p-0"
                placeholderTextColor="#64748b"
              />
            </View>

            <Button onPress={handleLogin} loading={loading}>
              Entrar
            </Button>
          </View>

          <View className="flex-row items-center justify-center mt-6">
            <Text className="text-slate-400">¿No tienes cuenta? </Text>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push("/(auth)/register")}
            >
              <Text className="text-primary font-semibold">Regístrate</Text>
            </Button>
          </View>

          <View className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
            <Text className="text-xs text-slate-400 text-center mb-3">
              Usuarios de demostración
            </Text>
            {([
              { email: "inquilino@saferent.es", pass: "Inquilino123!", label: "Inquilino" },
              { email: "propietario@saferent.es", pass: "Propietario123!", label: "Propietario" },
              { email: "admin@saferent.es", pass: "Admin123!", label: "Admin" },
            ] as const).map((u) => (
              <TouchableOpacity
                key={u.email}
                onPress={() => { setEmail(u.email); setPassword(u.pass); }}
                className="py-2"
              >
                <Text className="text-xs text-primary text-center font-medium">
                  {u.label}: {u.email}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

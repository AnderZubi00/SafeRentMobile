import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  User,
  Mail,
  Shield,
  LogOut,
  ChevronRight,
  Lock,
} from "lucide-react-native";
import { useAuth } from "@/store/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

const rolLabel: Record<string, string> = {
  INQUILINO: "Inquilino",
  PROPIETARIO: "Propietario",
  ADMINISTRADOR: "Administrador",
};

const rolColor: Record<string, "success" | "default" | "destructive"> = {
  INQUILINO: "success",
  PROPIETARIO: "default",
  ADMINISTRADOR: "destructive",
};

export default function ProfileScreen() {
  const { usuario, cerrarSesion } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await cerrarSesion();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Contraseña actualizada correctamente");
      setNewPassword("");
      setShowPassword(false);
    }
    setLoading(false);
  }

  if (!usuario) return null;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Mi Perfil</Text>
        </View>

        <View className="mx-5 mt-4 bg-white rounded-2xl border border-border p-6 items-center">
          <Avatar name={usuario.nombre_completo} size="lg" />
          <Text className="text-xl font-bold text-foreground mt-3">
            {usuario.nombre_completo}
          </Text>
          <Text className="text-sm text-muted-foreground mt-1">
            {usuario.email}
          </Text>
          <View className="flex-row gap-2 mt-3">
            <Badge variant={rolColor[usuario.rol] ?? "default"}>
              {rolLabel[usuario.rol] ?? usuario.rol}
            </Badge>
            {usuario.verificado_kyc && (
              <Badge variant="success">
                <View className="flex-row items-center">
                  <Shield size={10} color="#059669" />
                  <Text className="text-xs font-semibold text-emerald-700 ml-1">
                    KYC
                  </Text>
                </View>
              </Badge>
            )}
          </View>
        </View>

        <View className="mx-5 mt-4 bg-white rounded-2xl border border-border overflow-hidden">
          <View className="flex-row items-center px-5 py-4 border-b border-slate-50">
            <User size={18} color="#64748b" />
            <Text className="text-sm text-muted-foreground ml-3 w-20">
              Nombre
            </Text>
            <Text className="text-sm font-medium text-foreground flex-1">
              {usuario.nombre_completo}
            </Text>
          </View>
          <View className="flex-row items-center px-5 py-4 border-b border-slate-50">
            <Mail size={18} color="#64748b" />
            <Text className="text-sm text-muted-foreground ml-3 w-20">
              Email
            </Text>
            <Text className="text-sm font-medium text-foreground flex-1">
              {usuario.email}
            </Text>
          </View>
          <View className="flex-row items-center px-5 py-4">
            <Shield size={18} color="#64748b" />
            <Text className="text-sm text-muted-foreground ml-3 w-20">
              Rol
            </Text>
            <Text className="text-sm font-medium text-foreground flex-1">
              {rolLabel[usuario.rol] ?? usuario.rol}
            </Text>
          </View>
        </View>

        <View className="mx-5 mt-4 bg-white rounded-2xl border border-border p-5">
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Lock size={18} color="#64748b" />
              <Text className="text-base font-medium text-foreground ml-3">
                Cambiar contraseña
              </Text>
            </View>
            <ChevronRight
              size={18}
              color="#94a3b8"
              style={{
                transform: [{ rotate: showPassword ? "90deg" : "0deg" }],
              }}
            />
          </TouchableOpacity>

          {showPassword && (
            <View className="mt-4">
              <Input
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                containerClassName="mb-3"
              />
              <Button
                size="sm"
                loading={loading}
                onPress={handleChangePassword}
              >
                Actualizar contraseña
              </Button>
            </View>
          )}
        </View>

        <View className="mx-5 mt-6">
          <Button variant="destructive" onPress={handleLogout}>
            <View className="flex-row items-center">
              <LogOut size={18} color="#fff" />
              <Text className="text-white font-semibold text-base ml-2">
                Cerrar sesión
              </Text>
            </View>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

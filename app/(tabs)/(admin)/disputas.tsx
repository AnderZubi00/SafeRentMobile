import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Scale } from "lucide-react-native";
import { EmptyState } from "@/components/EmptyState";

export default function DisputasScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Disputas</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          Gestión de conflictos entre inquilinos y propietarios
        </Text>
      </View>

      <EmptyState
        icon={Scale}
        title="Sin disputas"
        description="No hay disputas activas. Esta funcionalidad estará completamente disponible próximamente."
      />
    </SafeAreaView>
  );
}

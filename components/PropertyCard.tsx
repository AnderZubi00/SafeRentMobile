import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, Bed, Bath, Maximize } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import type { Vivienda } from "@/lib/viviendas";
import { formatCurrency } from "@/lib/utils";

interface PropertyCardProps {
  vivienda: Vivienda;
  showStatus?: boolean;
}

export function PropertyCard({ vivienda, showStatus }: PropertyCardProps) {
  const router = useRouter();
  const foto = vivienda.fotos?.[0];

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/(explore)/vivienda/${vivienda.id}`)}
      activeOpacity={0.8}
      className="bg-white rounded-2xl border border-border overflow-hidden"
    >
      <View className="h-44 bg-slate-100">
        {foto ? (
          <Image
            source={{ uri: foto }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-slate-400">Sin foto</Text>
          </View>
        )}
        {showStatus && (
          <View className="absolute top-3 right-3">
            <Badge variant={vivienda.activa ? "success" : "secondary"}>
              {vivienda.activa ? "Activa" : "Pausada"}
            </Badge>
          </View>
        )}
      </View>

      <View className="p-4">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {vivienda.titulo}
        </Text>

        <View className="flex-row items-center mt-1">
          <MapPin size={14} color="#64748b" />
          <Text className="text-sm text-muted-foreground ml-1" numberOfLines={1}>
            {vivienda.barrio ? `${vivienda.barrio}, ` : ""}
            {vivienda.ciudad}
          </Text>
        </View>

        <View className="flex-row items-center mt-3 gap-4">
          <View className="flex-row items-center">
            <Bed size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground ml-1">
              {vivienda.habitaciones}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Bath size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground ml-1">
              {vivienda.banos}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Maximize size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground ml-1">
              {vivienda.m2} m²
            </Text>
          </View>
        </View>

        <View className="flex-row items-end justify-between mt-3">
          <Text className="text-xl font-bold text-primary">
            {formatCurrency(vivienda.precio_mes)}
          </Text>
          <Text className="text-sm text-muted-foreground">/mes</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

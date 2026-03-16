import { View, Text, Image } from "react-native";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import type { Solicitud } from "@/lib/solicitudes";
import { formatDate, estadoColor } from "@/lib/utils";

interface SolicitudCardProps {
  solicitud: Solicitud;
  showInquilino?: boolean;
  children?: React.ReactNode;
}

export function SolicitudCard({
  solicitud,
  showInquilino = false,
  children,
}: SolicitudCardProps) {
  const estado = estadoColor(solicitud.estado);
  const foto = solicitud.viviendas?.fotos?.[0];

  return (
    <View className="bg-white rounded-2xl border border-border p-4">
      <View className="flex-row">
        {foto && (
          <Image
            source={{ uri: foto }}
            className="w-16 h-16 rounded-xl mr-3"
            resizeMode="cover"
          />
        )}
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {solicitud.viviendas?.titulo ?? "Vivienda"}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {solicitud.viviendas?.ciudad}
          </Text>
          <View className="flex-row items-center mt-1 gap-2">
            <Badge
              variant={
                solicitud.estado === "PENDIENTE"
                  ? "warning"
                  : solicitud.estado === "ACEPTADA"
                    ? "success"
                    : "destructive"
              }
            >
              {estado.label}
            </Badge>
          </View>
        </View>
      </View>

      {showInquilino && solicitud.usuarios && (
        <View className="flex-row items-center mt-3 pt-3 border-t border-slate-100">
          <Avatar name={solicitud.usuarios.nombre_completo} size="sm" />
          <View className="ml-2">
            <Text className="text-sm font-medium text-foreground">
              {solicitud.usuarios.nombre_completo}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {solicitud.usuarios.email}
            </Text>
          </View>
        </View>
      )}

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <Text className="text-xs text-muted-foreground">
          {formatDate(solicitud.fecha_entrada)} — {formatDate(solicitud.fecha_salida)}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {solicitud.motivo}
        </Text>
      </View>

      {children && <View className="mt-3 pt-3 border-t border-slate-100">{children}</View>}
    </View>
  );
}

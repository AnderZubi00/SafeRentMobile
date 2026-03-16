import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  iconBg?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  color = "#6366f1",
  iconBg = "bg-primary-50",
}: StatsCardProps) {
  return (
    <View className="bg-white rounded-2xl border border-border p-4 flex-1">
      <View className={`w-10 h-10 rounded-xl ${iconBg} items-center justify-center mb-3`}>
        <Icon size={20} color={color} />
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-sm text-muted-foreground mt-0.5">{title}</Text>
    </View>
  );
}

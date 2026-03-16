import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-16 px-6">
      <View className="w-16 h-16 rounded-2xl bg-slate-100 items-center justify-center mb-4">
        <Icon size={28} color="#94a3b8" />
      </View>
      <Text className="text-lg font-bold text-foreground text-center">{title}</Text>
      <Text className="text-sm text-muted-foreground text-center mt-1 max-w-[280px]">
        {description}
      </Text>
      {children && <View className="mt-4">{children}</View>}
    </View>
  );
}

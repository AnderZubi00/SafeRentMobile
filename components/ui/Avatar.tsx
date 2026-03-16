import { View, Text, Image } from "react-native";
import { getInitials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: { container: "w-8 h-8", text: "text-xs" },
  default: { container: "w-10 h-10", text: "text-sm" },
  lg: { container: "w-14 h-14", text: "text-lg" },
};

export function Avatar({
  name,
  imageUrl,
  size = "default",
  className = "",
}: AvatarProps) {
  const styles = sizeStyles[size];

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={`${styles.container} rounded-full ${className}`}
      />
    );
  }

  return (
    <View
      className={`${styles.container} rounded-full bg-primary items-center justify-center ${className}`}
    >
      <Text className={`${styles.text} font-bold text-white`}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

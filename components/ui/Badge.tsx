import { View, Text } from "react-native";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantStyles: Record<Variant, { bg: string; text: string }> = {
  default: { bg: "bg-primary", text: "text-white" },
  secondary: { bg: "bg-slate-100", text: "text-slate-700" },
  destructive: { bg: "bg-red-100", text: "text-red-700" },
  outline: { bg: "bg-transparent border border-border", text: "text-foreground" },
  success: { bg: "bg-emerald-100", text: "text-emerald-700" },
  warning: { bg: "bg-amber-100", text: "text-amber-700" },
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <View className={`rounded-full px-3 py-1 self-start ${styles.bg} ${className}`}>
      {typeof children === "string" ? (
        <Text className={`text-xs font-semibold ${styles.text}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

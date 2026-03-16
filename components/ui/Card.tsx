import { View, Text, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <View
      className={`bg-white rounded-2xl border border-border p-4 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <View className={`pb-3 ${className}`} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text className={`text-lg font-bold text-foreground ${className}`}>
      {children}
    </Text>
  );
}

export function CardDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text className={`text-sm text-muted-foreground ${className}`}>
      {children}
    </Text>
  );
}

export function CardContent({
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <View className={className} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <View className={`pt-3 flex-row ${className}`} {...props}>
      {children}
    </View>
  );
}

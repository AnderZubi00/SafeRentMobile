import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from "react-native";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary";
type Size = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-primary",
  outline: "bg-transparent border border-border",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
  secondary: "bg-slate-100",
};

const variantTextStyles: Record<Variant, string> = {
  default: "text-white",
  outline: "text-foreground",
  ghost: "text-foreground",
  destructive: "text-white",
  secondary: "text-foreground",
};

const sizeStyles: Record<Size, string> = {
  default: "px-6 py-3",
  sm: "px-4 py-2",
  lg: "px-8 py-4",
  icon: "p-3",
};

const sizeTextStyles: Record<Size, string> = {
  default: "text-base",
  sm: "text-sm",
  lg: "text-lg",
  icon: "text-base",
};

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`rounded-2xl items-center justify-center flex-row ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? "opacity-50" : ""} ${className}`}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "default" || variant === "destructive" ? "#fff" : "#6366f1"}
          className="mr-2"
        />
      )}
      {typeof children === "string" ? (
        <Text
          className={`font-semibold ${variantTextStyles[variant]} ${sizeTextStyles[size]}`}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

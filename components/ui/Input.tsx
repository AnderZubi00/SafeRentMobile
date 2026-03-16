import { TextInput, View, Text, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  containerClassName = "",
  className = "",
  ...props
}: InputProps) {
  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-sm font-medium text-foreground mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base text-foreground bg-white ${
          error ? "border-destructive" : "border-input"
        } ${className}`}
        placeholderTextColor="#94a3b8"
        {...props}
      />
      {error && (
        <Text className="text-sm text-destructive mt-1">{error}</Text>
      )}
    </View>
  );
}

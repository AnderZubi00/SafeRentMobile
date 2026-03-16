import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from "react-native";
import { ChevronDown, Check, X } from "lucide-react-native";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function Select({
  label,
  placeholder = "Seleccionar...",
  options,
  value,
  onValueChange,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <View className={className}>
      {label && (
        <Text className="text-sm font-medium text-foreground mb-1.5">
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="border border-input rounded-xl px-4 py-3 flex-row items-center justify-between bg-white"
        activeOpacity={0.7}
      >
        <Text
          className={`text-base ${selectedLabel ? "text-foreground" : "text-slate-400"}`}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <ChevronDown size={18} color="#94a3b8" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent>
        <SafeAreaView className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
              <Text className="text-lg font-bold text-foreground">
                {label ?? "Seleccionar"}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50"
                  activeOpacity={0.6}
                >
                  <Text
                    className={`text-base ${
                      item.value === value
                        ? "text-primary font-semibold"
                        : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Check size={18} color="#6366f1" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

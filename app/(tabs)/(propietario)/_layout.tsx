import { Stack } from "expo-router";
import { PropietarioProvider } from "@/context/PropietarioContext";

export default function PropietarioLayout() {
  return (
    <PropietarioProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#f8fafc" },
        }}
      />
    </PropietarioProvider>
  );
}

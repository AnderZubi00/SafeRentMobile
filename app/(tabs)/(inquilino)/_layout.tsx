import { Stack } from "expo-router";
import { InquilinoProvider } from "@/context/InquilinoContext";

export default function InquilinoLayout() {
  return (
    <InquilinoProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#f8fafc" },
        }}
      />
    </InquilinoProvider>
  );
}

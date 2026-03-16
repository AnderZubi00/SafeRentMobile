import { Tabs } from "expo-router";
import {
  Search,
  Home,
  User,
  Plus,
  FileText,
  CreditCard,
  ShieldCheck,
  Scale,
  ClipboardList,
  BookOpen,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import type { Rol } from "@/lib/auth";

function getTabColor(rol: Rol | undefined) {
  switch (rol) {
    case "INQUILINO":
      return "#10b981";
    case "PROPIETARIO":
      return "#6366f1";
    case "ADMINISTRADOR":
      return "#f43f5e";
    default:
      return "#6366f1";
  }
}

export default function TabsLayout() {
  const { usuario } = useAuth();
  const rol = usuario?.rol;
  const activeColor = getTabColor(rol);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      {/* Explore tab - visible para todos */}
      <Tabs.Screen
        name="(explore)"
        options={{
          title: "Explorar",
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />

      {/* Inquilino tabs */}
      <Tabs.Screen
        name="(inquilino)"
        options={{
          title: "Mi Panel",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          href: rol === "INQUILINO" ? undefined : null,
        }}
      />

      {/* Propietario tabs */}
      <Tabs.Screen
        name="(propietario)"
        options={{
          title: "Mis Viviendas",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          href: rol === "PROPIETARIO" ? undefined : null,
        }}
      />

      {/* Admin tabs */}
      <Tabs.Screen
        name="(admin)"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size }) => (
            <ShieldCheck size={size} color={color} />
          ),
          href: rol === "ADMINISTRADOR" ? undefined : null,
        }}
      />

      {/* Profile tab - visible para todos */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

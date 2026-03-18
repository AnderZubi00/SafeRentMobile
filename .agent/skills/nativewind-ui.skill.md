# Skill: UI Profesional con NativeWind

**Activar cuando**: componentes, pantallas, diseño visual, estilos, tema, colores, animaciones.

---

## Paleta de Colores del Proyecto

```typescript
// tailwind.config.ts — tokens disponibles
primary:     "#6366f1"  // indigo  — acciones principales, propietario
success:     "#10b981"  // green   — confirmaciones, inquilino
destructive: "#f43f5e"  // rose    — errores, admin, peligro
warning:     "#f59e0b"  // amber   — alertas, pendiente
muted:       "#94a3b8"  // slate   — texto secundario
```

Siempre usar los tokens del tema en lugar de colores hardcoded.

---

## Patrones de Componentes Base

### Button (components/ui/Button.tsx)

```typescript
// Variantes disponibles: primary | secondary | destructive | ghost
// Tamaños: sm | md | lg
<Button variant="primary" size="lg" onPress={handleAction}>
  Solicitar vivienda
</Button>

// Loading state
<Button variant="primary" loading={cargando}>
  Guardar
</Button>
```

### Input (components/ui/Input.tsx)

```typescript
<Input
  label="Email"
  placeholder="tu@email.com"
  value={email}
  onChangeText={setEmail}
  error={errors.email}         // Mensaje de error en rojo debajo
  keyboardType="email-address"
  autoCapitalize="none"
/>
```

### Card (components/ui/Card.tsx)

```typescript
<Card className="p-4 mb-3">
  <Text className="text-base font-semibold text-slate-800">Título</Text>
  <Text className="text-sm text-slate-500 mt-1">Descripción</Text>
</Card>
```

---

## Estructura de Pantalla Estándar

```typescript
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View, Text } from "react-native";

export default function MiPantalla() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-slate-900">Título</Text>
        <Text className="text-sm text-slate-500 mt-1">Subtítulo opcional</Text>
      </View>

      {/* Contenido scrollable */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Contenido */}
      </ScrollView>
    </SafeAreaView>
  );
}
```

---

## Patrones de Loading y Empty State

```typescript
// Loading skeleton
if (cargando) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

// Empty state — usar componente EmptyState
import { EmptyState } from "@/components/EmptyState";

<EmptyState
  icon={Home}           // Lucide icon component
  title="Sin viviendas"
  description="Publica tu primera vivienda para empezar"
  action={{ label: "Publicar vivienda", onPress: handlePublicar }}
/>
```

---

## Badge de Estado KYC

```typescript
// Reutilizable en perfil e inquilino cards
function VerificadoBadge({ verificado }: { verificado: boolean }) {
  return (
    <View className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${
      verificado ? "bg-green-100" : "bg-amber-100"
    }`}>
      {verificado
        ? <CheckCircle size={12} color="#10b981" />
        : <Clock size={12} color="#f59e0b" />
      }
      <Text className={`text-xs font-medium ${
        verificado ? "text-green-700" : "text-amber-700"
      }`}>
        {verificado ? "Verificado" : "Pendiente KYC"}
      </Text>
    </View>
  );
}
```

---

## Reglas de UI Profesional

1. **Sombras**: `shadow-sm` en cards, nunca `shadow-xl` en listas.
2. **Espaciado**: padding interno de cards siempre `p-4`, gap entre items `gap-3`.
3. **Tipografía**: títulos `font-bold text-slate-900`, subtítulos `text-slate-500`, cuerpo `text-slate-700`.
4. **Bordes**: `rounded-xl` para cards principales, `rounded-lg` para inputs, `rounded-full` para badges/botones pill.
5. **Feedback táctil**: usar `TouchableOpacity` con `activeOpacity={0.7}` o `Pressable`.
6. **Imágenes**: siempre con fallback de placeholder cuando la URL es nula.
7. **Colores de rol**: usar el color del rol activo como `tintColor` en el tab activo (ver AGENT.md).

---

## Iconos (Lucide React Native)

```typescript
import { Home, User, FileText, CreditCard, Shield } from "lucide-react-native";

// Uso estándar — siempre pasar color y size como props, no className
<Home size={24} color="#6366f1" />
<Shield size={16} color="#10b981" strokeWidth={2} />
```

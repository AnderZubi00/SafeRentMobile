import { useState } from "react";
import { View, Text, FlatList, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FileText, CheckCircle, Clock, ChevronRight, Download } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { useInquilinoStore, type SolicitudConContrato } from "@/store/inquilinoStore";
import { type Pago } from "@/lib/pagos";
import { SolicitudCard } from "@/components/SolicitudCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";

// ---------------------------------------------------------------------------
// Helpers de progreso
// ---------------------------------------------------------------------------

type PasoReserva = 1 | 2 | 3 | 4;

interface ProgresoPaso {
  paso: PasoReserva;
  etiqueta: string;
  completado: boolean;
}

function calcularProgreso(sol: SolicitudConContrato, pagos: Pago[]): {
  pasos: ProgresoPaso[];
  pasoActual: PasoReserva;
  puedeContiniuar: boolean;
} {
  const tienePago = pagos.some(
    (p) => p.solicitud_id === sol.id && p.estado === "COMPLETADO"
  );

  const pasoIdentidad: ProgresoPaso = { paso: 1, etiqueta: "Identidad", completado: true };
  const pasoSolicitud: ProgresoPaso = {
    paso: 2,
    etiqueta: "Solicitud",
    completado: sol.estado === "ACEPTADA" || sol.estado === "RECHAZADA",
  };
  const pasoContrato: ProgresoPaso = {
    paso: 3,
    etiqueta: "Contrato",
    completado: !!(sol.contrato?.firmado_propietario && sol.contrato?.firmado_inquilino),
  };
  const pasoPago: ProgresoPaso = {
    paso: 4,
    etiqueta: "Pago",
    completado: tienePago,
  };

  let pasoActual: PasoReserva = 1;
  if (sol.estado === "RECHAZADA") pasoActual = 2;
  else if (!pasoSolicitud.completado) pasoActual = 2;
  else if (!pasoContrato.completado) pasoActual = 3;
  else if (!pasoPago.completado) pasoActual = 4;
  else pasoActual = 4;

  const puedeContiniuar =
    sol.estado !== "RECHAZADA" &&
    (!pasoContrato.completado || !pasoPago.completado);

  return {
    pasos: [pasoIdentidad, pasoSolicitud, pasoContrato, pasoPago],
    pasoActual,
    puedeContiniuar,
  };
}

function estadoEtiqueta(sol: SolicitudConContrato): string {
  if (sol.estado === "RECHAZADA") return "Rechazada";
  if (sol.contrato?.firmado_propietario && sol.contrato?.firmado_inquilino) return "Contrato firmado";
  if (sol.estado === "ACEPTADA" && sol.contrato && !sol.contrato.firmado_inquilino) return "Pendiente tu firma";
  if (sol.estado === "ACEPTADA" && sol.contrato?.firmado_inquilino && !sol.contrato?.firmado_propietario) return "Esperando propietario";
  if (sol.estado === "ACEPTADA") return "Aceptada — firmar contrato";
  return "En revisión";
}

// ---------------------------------------------------------------------------
// Barra de progreso
// ---------------------------------------------------------------------------

function BarraProgreso({ pasos, pasoActual }: { pasos: ProgresoPaso[]; pasoActual: PasoReserva }) {
  return (
    <View className="mt-3 mb-1">
      <View className="flex-row items-center">
        {pasos.map((p, i) => {
          const activo = pasoActual === p.paso;
          const completado = p.completado;
          return (
            <View key={p.paso} className="flex-row items-center flex-1">
              <View className="items-center">
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    completado ? "bg-emerald-500" : activo ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                >
                  {completado ? (
                    <CheckCircle size={12} color="#fff" />
                  ) : (
                    <Text className={`text-xs font-bold ${activo ? "text-white" : "text-slate-400"}`}>
                      {p.paso}
                    </Text>
                  )}
                </View>
                <Text
                  style={{ fontSize: 9 }}
                  className={`mt-0.5 ${activo ? "text-indigo-600 font-medium" : completado ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {p.etiqueta}
                </Text>
              </View>
              {i < pasos.length - 1 && (
                <View
                  className={`flex-1 h-px mx-0.5 mb-4 ${p.completado ? "bg-emerald-300" : "bg-slate-200"}`}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta individual de reserva
// ---------------------------------------------------------------------------

function ReservaCard({ sol, pagos }: { sol: SolicitudConContrato; pagos: Pago[] }) {
  const router = useRouter();
  const { pasos, pasoActual, puedeContiniuar } = calcularProgreso(sol, pagos);
  const etiqueta = estadoEtiqueta(sol);
  const pdfUrl = sol.contrato?.pdf_final_url ?? sol.contrato?.pdf_borrador_url;

  function continuar() {
    router.push({
      pathname: "/(tabs)/(inquilino)/checkout",
      params: { solicitud_id: sol.id, vivienda_id: sol.vivienda_id },
    });
  }

  return (
    <SolicitudCard solicitud={sol}>
      <View className="gap-3">
        {/* Badge de estado */}
        <View className="flex-row items-center justify-between">
          <Badge
            variant={
              sol.estado === "RECHAZADA"
                ? "destructive"
                : sol.contrato?.firmado_propietario && sol.contrato?.firmado_inquilino
                ? "success"
                : sol.estado === "ACEPTADA"
                ? "warning"
                : "secondary"
            }
          >
            <View className="flex-row items-center gap-1">
              {sol.contrato?.firmado_propietario && sol.contrato?.firmado_inquilino ? (
                <CheckCircle size={11} color="#059669" />
              ) : (
                <Clock size={11} color={sol.estado === "ACEPTADA" ? "#d97706" : "#6366f1"} />
              )}
              <Text className="text-xs">{etiqueta}</Text>
            </View>
          </Badge>

          {/* Botón descargar PDF */}
          {pdfUrl && (
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(pdfUrl)}
              className="flex-row items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 active:bg-slate-200"
            >
              <Download size={12} color="#64748b" />
              <Text className="text-xs text-slate-600">PDF</Text>
            </Pressable>
          )}
        </View>

        {/* Barra de progreso */}
        <BarraProgreso pasos={pasos} pasoActual={pasoActual} />

        {/* Botón continuar */}
        {puedeContiniuar && (
          <Pressable
            onPress={continuar}
            className="flex-row items-center justify-center gap-2 bg-indigo-500 rounded-xl py-3 active:bg-indigo-600"
          >
            <Text className="text-sm font-semibold text-white">Continuar reserva</Text>
            <ChevronRight size={16} color="#ffffff" />
          </Pressable>
        )}
      </View>
    </SolicitudCard>
  );
}

// ---------------------------------------------------------------------------
// Pantalla principal — con tabs Activas / Finalizadas
// ---------------------------------------------------------------------------

type TabReservas = "activas" | "finalizadas";

export default function ReservasScreen() {
  const { solicitudes, pagos, cargando, recargar } = useInquilinoStore();
  const [tabActiva, setTabActiva] = useState<TabReservas>("activas");
  // El socket está gestionado en el layout (inquilino/_layout.tsx) y llama
  // recargar() automáticamente en solicitud:updated, contrato:signed y pago:completed.

  // Filtrar según tab
  const solicitudesFiltradas = solicitudes.filter((sol) => {
    const tienePago = pagos.some((p) => p.solicitud_id === sol.id && p.estado === "COMPLETADO");
    if (tabActiva === "finalizadas") {
      return sol.estado === "RECHAZADA" || tienePago;
    }
    return sol.estado !== "RECHAZADA" && !tienePago;
  });

  const conteoActivas = solicitudes.filter((sol) => {
    const tienePago = pagos.some((p) => p.solicitud_id === sol.id && p.estado === "COMPLETADO");
    return sol.estado !== "RECHAZADA" && !tienePago;
  }).length;

  const conteoFinalizadas = solicitudes.length - conteoActivas;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground">Mis Reservas</Text>
        <Text className="text-sm text-muted-foreground mt-1">Tus solicitudes de alojamiento</Text>
      </View>

      {/* Tabs — igual que web */}
      <View className="flex-row px-5 gap-2 mb-3">
        {(["activas", "finalizadas"] as TabReservas[]).map((tab) => {
          const esActiva = tabActiva === tab;
          const conteo = tab === "activas" ? conteoActivas : conteoFinalizadas;
          return (
            <Pressable
              key={tab}
              onPress={() => setTabActiva(tab)}
              className={`flex-row items-center gap-2 px-4 py-2 rounded-xl ${
                esActiva ? "bg-indigo-500" : "bg-white border border-slate-200"
              }`}
            >
              <Text className={`text-sm font-semibold capitalize ${esActiva ? "text-white" : "text-slate-600"}`}>
                {tab === "activas" ? "Activas" : "Finalizadas"}
              </Text>
              {conteo > 0 && (
                <View className={`w-5 h-5 rounded-full items-center justify-center ${esActiva ? "bg-white/20" : "bg-slate-100"}`}>
                  <Text className={`text-xs font-bold ${esActiva ? "text-white" : "text-slate-600"}`}>{conteo}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {cargando ? (
        <View className="px-5 gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </View>
      ) : (
        <FlatList
          data={solicitudesFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => <ReservaCard sol={item} pagos={pagos} />}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={recargar} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <EmptyState
              icon={FileText}
              title={tabActiva === "activas" ? "Sin reservas activas" : "Sin reservas finalizadas"}
              description={
                tabActiva === "activas"
                  ? "Aún no tienes solicitudes en curso."
                  : "Aquí aparecerán las reservas completadas o rechazadas."
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

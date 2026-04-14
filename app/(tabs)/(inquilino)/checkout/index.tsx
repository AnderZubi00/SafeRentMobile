import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useAuthStore } from "@/store/authStore";
import { useNotifications } from "@/hooks/useNotifications";
import { obtenerEstadoSolicitud } from "@/lib/solicitudes";
import { obtenerViviendaById } from "@/lib/viviendas";
import { type Vivienda } from "@/lib/viviendas";
import StepKyc, { type KycResult } from "./StepKyc";
import StepTemporalidad from "./StepTemporalidad";
import StepContrato from "./StepContrato";
import StepPago from "./StepPago";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const PASOS = ["Identidad", "Solicitud", "Contrato", "Pago"] as const;
type Paso = 1 | 2 | 3 | 4 | 5; // 5 = éxito

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determinarPaso(estado: string, contrato: { firmado_propietario: boolean; firmado_inquilino: boolean } | null | undefined, pagosCompletados: number): Paso {
  if (pagosCompletados > 0) return 5;
  if (contrato?.firmado_propietario && contrato?.firmado_inquilino) return 4;
  if (estado === "ACEPTADA") return 3;
  if (estado === "PENDIENTE") return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function CheckoutScreen() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const params = useLocalSearchParams<{
    vivienda_id?: string;
    propietario_id?: string;
    entrada?: string;
    salida?: string;
    solicitud_id?: string;
  }>();

  const [paso, setPaso] = useState<Paso>(1);
  const [cargandoEstado, setCargandoEstado] = useState(!!params.solicitud_id);
  const [solicitudId, setSolicitudId] = useState<string | null>(params.solicitud_id ?? null);
  const [kycResult, setKycResult] = useState<KycResult | null>(null);
  const [vivienda, setVivienda] = useState<Vivienda | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(null);
  const [solicitudRechazada, setSolicitudRechazada] = useState(false);

  // Cargar vivienda si venimos con vivienda_id
  useEffect(() => {
    if (!params.vivienda_id) return;
    obtenerViviendaById(params.vivienda_id).then(({ data }) => {
      if (data) setVivienda(data);
    });
  }, [params.vivienda_id]);

  // Si venimos con solicitud_id: recuperar estado y determinar paso
  const recuperarEstado = useCallback(async () => {
    if (!params.solicitud_id) return;
    setCargandoEstado(true);
    const estado = await obtenerEstadoSolicitud(params.solicitud_id);
    if (estado.error) { setCargandoEstado(false); return; }
    setPaso(determinarPaso(estado.estado, estado.contrato, estado.pagos_completados ?? 0));
    setSolicitudId(params.solicitud_id);

    // Cargar vivienda si no está
    if (!vivienda && params.vivienda_id) {
      const { data } = await obtenerViviendaById(params.vivienda_id);
      if (data) setVivienda(data);
    }
    setCargandoEstado(false);
  }, [params.solicitud_id, params.vivienda_id, vivienda]);

  useEffect(() => {
    recuperarEstado();
  }, [recuperarEstado]);

  // Socket: avanzar automáticamente según eventos del backend
  useNotifications({
    "solicitud:updated": async (data: unknown) => {
      const d = data as { solicitudId?: string; estado?: string; motivoRechazo?: string };
      if (d?.solicitudId && d.solicitudId !== solicitudId) return;
      if (d?.estado === "ACEPTADA" && paso === 2) { setSolicitudRechazada(false); setPaso(3); }
      if (d?.estado === "RECHAZADA") {
        setSolicitudRechazada(true);
        setMotivoRechazo(d.motivoRechazo ?? null);
        setPaso(2);
      }
    },
    "contrato:signed": async (data: unknown) => {
      const d = data as { solicitudId?: string };
      if (!solicitudId) return;
      if (d?.solicitudId && d.solicitudId !== solicitudId) return;
      // Recargar estado para verificar si ambos firmaron
      const estado = await obtenerEstadoSolicitud(solicitudId);
      if (estado.contrato?.firmado_propietario && estado.contrato?.firmado_inquilino) {
        setPaso(4);
      }
    },
    "pago:completed": (data: unknown) => {
      const d = data as { solicitudId?: string };
      if (solicitudId && d?.solicitudId && d.solicitudId !== solicitudId) return;
      setPaso(5);
    },
  }, !!(usuario && solicitudId));

  // ---------------------------------------------------------------------------
  // Handlers de paso
  // ---------------------------------------------------------------------------

  function handleKycCompleted(result: KycResult) {
    setKycResult(result);
    // Auto-avanzar a paso 2 con pequeña pausa para que el usuario vea el éxito
    setTimeout(() => setPaso(2), 1000);
  }

  function handleTemporalidadCompleted(newSolicitudId: string) {
    setSolicitudId(newSolicitudId);
    // No avanzamos manualmente — el socket solicitud:updated ACEPTADA lo hará
    // El componente StepTemporalidad ya muestra "Esperando propietario"
  }

  function handleContratoCompleted() {
    setPaso(4);
  }

  function handlePagoCompleted() {
    setPaso(5);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (cargandoEstado) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-slate-500">Cargando tu reserva…</Text>
      </SafeAreaView>
    );
  }

  const propietarioId = params.propietario_id ?? vivienda?.propietario_id ?? "";
  const entrada = params.entrada ?? "";
  const salida = params.salida ?? "";

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-xl bg-slate-50 mr-3">
            <ArrowLeft size={20} color="#334155" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
              {vivienda?.titulo ?? "Reservar alojamiento"}
            </Text>
          </View>
        </View>

        {/* Stepper */}
        {paso < 5 && (
          <View className="bg-white px-5 py-4 border-b border-slate-100">
            <View className="flex-row items-center justify-between">
              {PASOS.map((nombre, i) => {
                const numPaso = (i + 1) as Paso;
                const activo = paso === numPaso;
                const completado = paso > numPaso;
                return (
                  <View key={nombre} className="flex-row items-center flex-1">
                    <View className="items-center">
                      <View className={`w-8 h-8 rounded-full items-center justify-center ${completado ? "bg-emerald-500" : activo ? "bg-indigo-500" : "bg-slate-200"}`}>
                        {completado ? (
                          <CheckCircle size={16} color="#ffffff" />
                        ) : (
                          <Text className={`text-xs font-bold ${activo ? "text-white" : "text-slate-400"}`}>{numPaso}</Text>
                        )}
                      </View>
                      <Text className={`text-xs mt-1 font-medium ${activo ? "text-indigo-600" : completado ? "text-emerald-600" : "text-slate-400"}`}>{nombre}</Text>
                    </View>
                    {i < PASOS.length - 1 && (
                      <View className={`flex-1 h-px mx-1 mb-4 ${paso > numPaso ? "bg-emerald-300" : "bg-slate-200"}`} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Contenido según paso */}
        <View className="flex-1">
          {paso === 1 && (
            <StepKyc
              verificadoKyc={!!usuario?.verificado_kyc}
              onCompleted={handleKycCompleted}
              onError={(msg) => console.warn("KYC error:", msg)}
            />
          )}

          {paso === 2 && (
            <StepTemporalidad
              viviendaId={params.vivienda_id ?? vivienda?.id ?? ""}
              propietarioId={propietarioId}
              fechaEntrada={entrada}
              fechaSalida={salida}
              documentoIdentidadUri={kycResult?.documentoIdentidadUri ?? ""}
              documentoIdentidadType={kycResult?.documentoIdentidadType ?? "image/jpeg"}
              solicitudRechazada={solicitudRechazada}
              motivoRechazo={motivoRechazo}
              onCompleted={handleTemporalidadCompleted}
            />
          )}

          {paso === 3 && solicitudId && (
            <StepContrato
              solicitudId={solicitudId}
              onCompleted={handleContratoCompleted}
            />
          )}

          {paso === 4 && solicitudId && vivienda && (
            <StepPago
              solicitudId={solicitudId}
              viviendaId={vivienda.id}
              precioPorMes={vivienda.precio_mes}
              fianza={vivienda.fianza_importe}
              fechaEntrada={entrada}
              fechaSalida={salida}
              onCompleted={handlePagoCompleted}
            />
          )}

          {paso === 5 && <PantallaExito onVolver={() => router.replace("/(tabs)/(inquilino)/reservas")} />}
        </View>
      </SafeAreaView>
    </StripeProvider>
  );
}

// ---------------------------------------------------------------------------
// Pantalla de éxito final
// ---------------------------------------------------------------------------

function PantallaExito({ onVolver }: { onVolver: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ flex: 1 }} className="flex-1">
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-28 w-28 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle size={64} color="#10b981" />
        </View>
        <Text className="text-center text-2xl font-bold text-slate-900">¡Reserva completada!</Text>
        <Text className="mt-3 text-center text-sm text-slate-500 leading-5">
          Todo el proceso ha sido completado con éxito.{"\n"}
          Recibirás los detalles por email.
        </Text>

        <View className="mt-6 w-full gap-3">
          <View className="bg-emerald-50 rounded-2xl p-4">
            <View className="flex-row items-center gap-3 mb-2">
              <CheckCircle size={16} color="#10b981" />
              <Text className="text-sm font-semibold text-emerald-800">Identidad verificada</Text>
            </View>
            <View className="flex-row items-center gap-3 mb-2">
              <CheckCircle size={16} color="#10b981" />
              <Text className="text-sm font-semibold text-emerald-800">Solicitud aceptada</Text>
            </View>
            <View className="flex-row items-center gap-3 mb-2">
              <CheckCircle size={16} color="#10b981" />
              <Text className="text-sm font-semibold text-emerald-800">Contrato firmado</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <CheckCircle size={16} color="#10b981" />
              <Text className="text-sm font-semibold text-emerald-800">Pago realizado</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={onVolver}
          className="mt-8 w-full rounded-2xl bg-indigo-500 py-4 items-center active:bg-indigo-600"
        >
          <Text className="text-base font-semibold text-white">Ver mis reservas</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

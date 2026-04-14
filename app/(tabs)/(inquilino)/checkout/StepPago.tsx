import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import {
  CreditCard,
  CheckCircle,
  ShieldCheck,
  ChevronRight,
} from "lucide-react-native";
import { crearPaymentIntent, obtenerFeePreview, type FeeBreakdown } from "@/lib/pagos";
import { formatCurrency } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useInquilinoStore } from "@/store/inquilinoStore";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Props {
  solicitudId: string;
  viviendaId: string;
  precioPorMes: number;
  fianza: number;
  fechaEntrada: string;
  fechaSalida: string;
  onCompleted: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcularMeses(entrada: string, salida: string): number {
  const d1 = new Date(entrada);
  const d2 = new Date(salida);
  const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(1, Math.round(diff));
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function StepPago({
  solicitudId,
  viviendaId,
  precioPorMes,
  fianza,
  fechaEntrada,
  fechaSalida,
  onCompleted,
}: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const recargar = useInquilinoStore((s) => s.recargar);

  const [fee, setFee] = useState<FeeBreakdown | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [pagado, setPagado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meses = calcularMeses(fechaEntrada, fechaSalida);
  const importeAlquiler = precioPorMes * meses;
  const importeTotal = importeAlquiler + fianza;

  useEffect(() => {
    async function preparar() {
      setCargando(true);
      setError(null);
      try {
        // Obtener desglose de fees
        const { data: feeData } = await obtenerFeePreview(importeTotal);
        if (feeData) setFee(feeData);

        // Crear PaymentIntent y preparar PaymentSheet
        const { data: pi, error: piError } = await crearPaymentIntent({
          solicitud_id: solicitudId,
          vivienda_id: viviendaId,
          concepto: `Reserva ${meses} ${meses === 1 ? "mes" : "meses"} + fianza`,
          importe: feeData?.totalCharge ?? importeTotal,
          fianza_importe: fianza,
          metodo: "tarjeta",
        });

        if (piError || !pi) {
          setError(piError ?? "Error al preparar el pago.");
          return;
        }

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: pi.clientSecret,
          merchantDisplayName: "SafeRent",
          style: "automatic",
          appearance: {
            colors: {
              primary: "#6366f1",
            },
          },
        });

        if (initError) {
          setError(initError.message);
        }
      } catch {
        setError("Error al preparar el pago. Inténtalo de nuevo.");
      } finally {
        setCargando(false);
      }
    }
    preparar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket: confirmar pago y recargar datos
  useNotifications({
    "pago:completed": () => {
      recargar();
      setPagado(true);
      onCompleted();
    },
  });

  async function realizarPago() {
    setPagando(true);
    setError(null);
    try {
      const { error: paymentError } = await presentPaymentSheet();
      if (paymentError) {
        if (paymentError.code !== "Canceled") {
          setError(paymentError.message);
        }
        return;
      }
      // El webhook del backend confirmará y enviará el socket pago:completed
      // Mientras tanto, marcamos como pagado optimistamente
      setPagado(true);
      await recargar();
      onCompleted();
    } finally {
      setPagando(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Renders
  // ---------------------------------------------------------------------------

  if (pagado) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-28 w-28 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle size={64} color="#10b981" />
        </View>
        <Text className="text-center text-2xl font-bold text-slate-900">¡Reserva confirmada!</Text>
        <Text className="mt-3 text-center text-sm text-slate-500">
          Tu pago ha sido procesado correctamente.{"\n"}Recibirás un email de confirmación.
        </Text>
        <View className="mt-6 bg-emerald-50 rounded-2xl px-6 py-4 w-full">
          <Text className="text-center text-sm font-semibold text-emerald-700">
            Total pagado: {formatCurrency(fee?.totalCharge ?? importeTotal)}
          </Text>
        </View>
      </View>
    );
  }

  if (cargando) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-slate-500">Preparando el pago…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* Desglose del pago */}
      <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5">
        <View className="px-5 py-4 border-b border-slate-100">
          <Text className="text-sm font-semibold text-slate-700">Resumen del pago</Text>
        </View>
        <View className="px-5 py-4 gap-3">
          <LineaPago label={`Alquiler × ${meses} ${meses === 1 ? "mes" : "meses"}`} importe={importeAlquiler} />
          <LineaPago label="Fianza (reembolsable)" importe={fianza} />
          {fee && (
            <LineaPago
              label={`Tarifa de servicio SafeRent`}
              importe={fee.guestFee}
              muted
            />
          )}
          <View className="h-px bg-slate-100 my-1" />
          <LineaPago
            label="Total"
            importe={fee?.totalCharge ?? importeTotal + (fee?.guestFee ?? 0)}
            bold
          />
        </View>
      </View>

      {/* Seguridad */}
      <View className="flex-row items-center gap-3 bg-slate-50 rounded-2xl p-4 mb-5">
        <ShieldCheck size={20} color="#6366f1" />
        <Text className="flex-1 text-xs text-slate-600 leading-4">
          Pago seguro procesado por Stripe. Tus datos bancarios están cifrados y protegidos.
        </Text>
      </View>

      {/* Error */}
      {error && (
        <View className="bg-rose-50 rounded-2xl p-4 mb-4">
          <Text className="text-sm text-rose-700">{error}</Text>
        </View>
      )}

      {/* Botón pagar */}
      <Pressable
        onPress={realizarPago}
        disabled={pagando}
        className={`flex-row items-center justify-center rounded-2xl py-4 px-6 ${pagando ? "bg-slate-200" : "bg-indigo-500 active:bg-indigo-600"}`}
      >
        {pagando ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <CreditCard size={20} color="#ffffff" />
            <Text className="ml-2 text-base font-semibold text-white">
              Pagar {formatCurrency(fee?.totalCharge ?? importeTotal)}
            </Text>
            <ChevronRight size={18} color="#ffffff" className="ml-auto" />
          </>
        )}
      </Pressable>

      <Text className="text-center text-xs text-slate-400 mt-4">
        Al confirmar, aceptas los términos y condiciones de SafeRent.
      </Text>
    </ScrollView>
  );
}

function LineaPago({
  label,
  importe,
  muted = false,
  bold = false,
}: {
  label: string;
  importe: number;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={`text-sm ${muted ? "text-slate-400" : "text-slate-600"} ${bold ? "font-bold text-slate-900" : ""}`}>
        {label}
      </Text>
      <Text className={`text-sm ${muted ? "text-slate-400" : "text-slate-700"} ${bold ? "font-bold text-slate-900" : ""}`}>
        {formatCurrency(importe)}
      </Text>
    </View>
  );
}

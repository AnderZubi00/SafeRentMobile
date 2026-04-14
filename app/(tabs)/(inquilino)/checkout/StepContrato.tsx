import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  PanResponder,
  Alert,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";
import {
  FileText,
  PenLine,
  Trash2,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { obtenerContratoBySolicitud, firmarContrato, type ContratoDigital } from "@/lib/contratos";
import { obtenerSolicitudById } from "@/lib/solicitudes";
import { useNotifications } from "@/hooks/useNotifications";
import { formatCurrency, formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Punto { x: number; y: number }
interface Trazo { puntos: Punto[] }

interface Props {
  solicitudId: string;
  onCompleted: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface ResumenContrato {
  viviendaTitulo: string;
  ciudad: string;
  fechaEntrada: string;
  fechaSalida: string;
  precioMes: number;
  fianza: number;
  meses: number;
}

export default function StepContrato({ solicitudId, onCompleted }: Props) {
  const [contrato, setContrato] = useState<ContratoDigital | null>(null);
  const [resumen, setResumen] = useState<ResumenContrato | null>(null);
  const [cargando, setCargando] = useState(true);
  const [firmando, setFirmando] = useState(false);
  const [firmadoInquilino, setFirmadoInquilino] = useState(false);
  const [esperandoPropietario, setEsperandoPropietario] = useState(false);
  const [mostrarFirma, setMostrarFirma] = useState(false);
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [trazaActual, setTrazaActual] = useState<Punto[]>([]);
  const firmaPanelRef = useRef<View>(null);

  const cargarContrato = useCallback(async () => {
    setCargando(true);
    const [contratoRes, solicitudRes] = await Promise.all([
      obtenerContratoBySolicitud(solicitudId),
      obtenerSolicitudById(solicitudId),
    ]);
    if (contratoRes.data) {
      setContrato(contratoRes.data);
      setFirmadoInquilino(contratoRes.data.firmado_inquilino);
      if (contratoRes.data.firmado_inquilino && !contratoRes.data.firmado_propietario) setEsperandoPropietario(true);
      if (contratoRes.data.firmado_inquilino && contratoRes.data.firmado_propietario) onCompleted();
    }
    if (solicitudRes.data) {
      const sol = solicitudRes.data;
      const entrada = sol.fecha_entrada;
      const salida = sol.fecha_salida;
      const meses = Math.max(1, Math.round(
        (new Date(salida).getTime() - new Date(entrada).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      ));
      setResumen({
        viviendaTitulo: sol.viviendas?.titulo ?? "Vivienda",
        ciudad: sol.viviendas?.ciudad ?? "",
        fechaEntrada: entrada,
        fechaSalida: salida,
        precioMes: sol.viviendas?.precio_mes ?? 0,
        fianza: sol.viviendas?.fianza_importe ?? 0,
        meses,
      });
    }
    setCargando(false);
  }, [solicitudId, onCompleted]);

  useEffect(() => {
    cargarContrato();
  }, [cargarContrato]);

  // Socket: avanzar cuando propietario firma
  useNotifications({
    "contrato:signed": () => {
      cargarContrato();
    },
    "solicitud:updated": () => {
      cargarContrato();
    },
  });

  // ---------------------------------------------------------------------------
  // Firma SVG
  // ---------------------------------------------------------------------------

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      setTrazaActual([{ x: locationX, y: locationY }]);
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      setTrazaActual((prev) => [...prev, { x: locationX, y: locationY }]);
    },
    onPanResponderRelease: () => {
      if (trazaActual.length > 1) {
        setTrazos((prev) => [...prev, { puntos: trazaActual }]);
      }
      setTrazaActual([]);
    },
  });

  function limpiarFirma() {
    setTrazos([]);
    setTrazaActual([]);
  }

  function puntosAPath(puntos: Punto[]): string {
    if (puntos.length < 2) return "";
    return puntos.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      return `${acc} L ${p.x} ${p.y}`;
    }, "");
  }

  function firmaABase64(): string {
    // Convertir los trazos SVG a una cadena base64 simple (SVG embebido en data URI)
    const paths = trazos.map((t) => `<path d="${puntosAPath(t.puntos)}" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" style="background:white">${paths}</svg>`;
    return btoa(unescape(encodeURIComponent(svg)));
  }

  async function confirmarFirma() {
    if (trazos.length === 0) {
      Alert.alert("Firma vacía", "Por favor traza tu firma antes de confirmar.");
      return;
    }
    if (!contrato) return;
    setFirmando(true);
    try {
      const firmaBase64 = firmaABase64();
      const { error } = await firmarContrato(contrato.id, "inquilino", firmaBase64);
      if (error) {
        Alert.alert("Error", error);
        return;
      }
      setFirmadoInquilino(true);
      setMostrarFirma(false);
      setEsperandoPropietario(true);
    } finally {
      setFirmando(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Renders
  // ---------------------------------------------------------------------------

  if (cargando) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-slate-500">Cargando contrato…</Text>
      </View>
    );
  }

  if (!contrato) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator size="small" color="#6366f1" />
        <Text className="mt-4 text-center text-slate-500">
          El contrato se está generando…{"\n"}Esto puede tardar unos segundos.
        </Text>
      </View>
    );
  }

  // Panel de firma
  if (mostrarFirma) {
    return (
      <View className="flex-1 bg-white">
        <View className="px-5 pt-5 pb-3">
          <Text className="text-lg font-bold text-slate-900">Traza tu firma</Text>
          <Text className="text-xs text-slate-500 mt-1">Usa el dedo para firmar en el recuadro</Text>
        </View>

        <View className="mx-5 rounded-2xl border-2 border-indigo-300 overflow-hidden bg-white" style={{ height: 180 }}>
          <View ref={firmaPanelRef} style={{ flex: 1 }} {...panResponder.panHandlers}>
            <Svg width="100%" height="100%">
              {trazos.map((t, i) => (
                <Path key={i} d={puntosAPath(t.puntos)} stroke="#1e293b" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {trazaActual.length > 1 && (
                <Path d={puntosAPath(trazaActual)} stroke="#1e293b" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>
            {trazos.length === 0 && trazaActual.length === 0 && (
              <View className="absolute inset-0 items-center justify-center pointer-events-none">
                <PenLine size={28} color="#cbd5e1" />
                <Text className="text-slate-300 text-sm mt-2">Firma aquí</Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row px-5 gap-3 mt-4">
          <Pressable onPress={limpiarFirma} className="flex-row items-center justify-center rounded-xl border border-slate-200 px-4 py-3 gap-2">
            <Trash2 size={18} color="#64748b" />
            <Text className="text-sm text-slate-600">Limpiar</Text>
          </Pressable>
          <Pressable onPress={confirmarFirma} disabled={firmando || trazos.length === 0}
            className={`flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2 ${firmando || trazos.length === 0 ? "bg-slate-200" : "bg-indigo-500 active:bg-indigo-600"}`}>
            {firmando ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <CheckCircle size={18} color={trazos.length === 0 ? "#94a3b8" : "#fff"} />
                <Text className={`text-sm font-semibold ${trazos.length === 0 ? "text-slate-400" : "text-white"}`}>Confirmar firma</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable onPress={() => setMostrarFirma(false)} className="mt-4 mx-5 items-center py-3">
          <Text className="text-sm text-slate-500">Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* Resumen del contrato — igual que web */}
      {resumen && (
        <View className="bg-indigo-50 rounded-2xl p-4 mb-5">
          <Text className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">Resumen del contrato</Text>
          <FilaResumen label="Vivienda" valor={`${resumen.viviendaTitulo}, ${resumen.ciudad}`} />
          <FilaResumen
            label="Duración"
            valor={`${formatDate(resumen.fechaEntrada)} → ${formatDate(resumen.fechaSalida)} (${resumen.meses} ${resumen.meses === 1 ? "mes" : "meses"})`}
          />
          <FilaResumen label="Renta mensual" valor={`${formatCurrency(resumen.precioMes)}/mes`} />
          <FilaResumen label="Fianza" valor={formatCurrency(resumen.fianza)} />
          <View className="mt-2 pt-2 border-t border-indigo-200">
            <FilaResumen
              label="Total primer pago"
              valor={formatCurrency(resumen.precioMes * resumen.meses + resumen.fianza)}
              bold
            />
          </View>
        </View>
      )}

      {/* Preview del PDF */}
      <View className="mb-5">
        <Text className="text-sm font-semibold text-slate-700 mb-3">Contrato de arrendamiento</Text>
        {contrato.pdf_borrador_url ? (
          <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: 200 }}>
            <WebView
              source={{ uri: contrato.pdf_borrador_url }}
              style={{ flex: 1 }}
              scrollEnabled
            />
          </View>
        ) : (
          <View className="bg-slate-100 rounded-2xl p-6 items-center">
            <FileText size={32} color="#94a3b8" />
            <Text className="text-sm text-slate-500 mt-2">Cargando contrato…</Text>
          </View>
        )}
        {contrato.pdf_borrador_url && (
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(contrato.pdf_borrador_url!)}
            className="flex-row items-center gap-2 mt-2 ml-1"
          >
            <ExternalLink size={14} color="#6366f1" />
            <Text className="text-xs text-indigo-500">Ver en pantalla completa</Text>
          </Pressable>
        )}
      </View>

      {/* Estado de firmas */}
      <View className="bg-slate-50 rounded-2xl p-4 mb-5">
        <Text className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Estado de firmas</Text>
        <FirmaEstado label="Propietario" firmado={contrato.firmado_propietario} />
        <View className="h-2" />
        <FirmaEstado label="Tú (inquilino)" firmado={firmadoInquilino} />
      </View>

      {/* Acción */}
      {!firmadoInquilino ? (
        <Pressable
          onPress={() => setMostrarFirma(true)}
          className="flex-row items-center justify-center rounded-2xl bg-indigo-500 py-4 px-6 active:bg-indigo-600"
        >
          <PenLine size={20} color="#ffffff" />
          <Text className="ml-2 text-base font-semibold text-white">Firmar contrato</Text>
        </Pressable>
      ) : esperandoPropietario ? (
        <View className="bg-amber-50 rounded-2xl p-4 flex-row items-start gap-3">
          <Clock size={20} color="#f59e0b" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-amber-800">Esperando firma del propietario</Text>
            <Text className="text-xs text-amber-600 mt-1">La pantalla avanzará automáticamente cuando el propietario firme.</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function FilaResumen({ label, valor, bold = false }: { label: string; valor: string; bold?: boolean }) {
  return (
    <View className="flex-row items-start justify-between mb-1.5">
      <Text className="text-xs text-indigo-600 flex-1">{label}</Text>
      <Text className={`text-xs flex-1 text-right ${bold ? "font-bold text-indigo-900" : "text-indigo-800"}`}>
        {valor}
      </Text>
    </View>
  );
}

function FirmaEstado({ label, firmado }: { label: string; firmado: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-slate-700">{label}</Text>
      <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1 ${firmado ? "bg-emerald-100" : "bg-slate-200"}`}>
        {firmado ? <CheckCircle size={14} color="#10b981" /> : <Clock size={14} color="#94a3b8" />}
        <Text className={`text-xs font-medium ${firmado ? "text-emerald-700" : "text-slate-500"}`}>
          {firmado ? "Firmado" : "Pendiente"}
        </Text>
      </View>
    </View>
  );
}

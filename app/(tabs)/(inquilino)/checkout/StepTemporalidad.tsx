import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  FileText,
  Upload,
  CheckCircle,
  Calendar,
  AlertCircle,
  XCircle,
  Search,
} from "lucide-react-native";
import { crearSolicitud } from "@/lib/solicitudes";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Motivo = "Estudios" | "Trabajo temporal" | "Otros";

interface Props {
  viviendaId: string;
  propietarioId: string;
  fechaEntrada: string;
  fechaSalida: string;
  documentoIdentidadUri: string;
  documentoIdentidadType: string;
  solicitudRechazada?: boolean;
  motivoRechazo?: string | null;
  onCompleted: (solicitudId: string) => void;
  onError?: (msg: string) => void;
}

const MOTIVOS: { value: Motivo; label: string; descripcion: string }[] = [
  { value: "Estudios", label: "Estudios", descripcion: "Matrícula universitaria, FP, curso..." },
  { value: "Trabajo temporal", label: "Trabajo temporal", descripcion: "Contrato laboral temporal, traslado..." },
  { value: "Otros", label: "Otros motivos", descripcion: "Obras, salud, familiar..." },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function StepTemporalidad({
  viviendaId,
  propietarioId,
  fechaEntrada,
  fechaSalida,
  documentoIdentidadUri,
  documentoIdentidadType,
  solicitudRechazada = false,
  motivoRechazo,
  onCompleted,
  onError,
}: Props) {
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [motivoDetalle, setMotivoDetalle] = useState("");
  const [justificativo, setJustificativo] = useState<{ uri: string; type: string; nombre: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [esperando, setEsperando] = useState(false);

  const mesesEstancia = (() => {
    const entrada = new Date(fechaEntrada);
    const salida = new Date(fechaSalida);
    const diff = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.max(1, Math.round(diff));
  })();

  async function seleccionarJustificativo() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setJustificativo({
        uri: asset.uri,
        type: asset.mimeType ?? "application/pdf",
        nombre: asset.name,
      });
    } catch {
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
    }
  }

  async function enviarSolicitud() {
    if (!motivo) { Alert.alert("Falta el motivo", "Selecciona el motivo de tu estancia."); return; }
    if (!justificativo) { Alert.alert("Falta el justificativo", "Sube el documento que justifique tu estancia."); return; }
    if (motivo === "Otros" && !motivoDetalle.trim()) { Alert.alert("Falta el detalle", "Describe brevemente el motivo de tu estancia."); return; }

    setEnviando(true);
    try {
      const { data, error } = await crearSolicitud(
        {
          vivienda_id: viviendaId,
          propietario_id: propietarioId,
          motivo,
          motivo_detalle: motivo === "Otros" ? motivoDetalle.trim() : undefined,
          fecha_entrada: fechaEntrada,
          fecha_salida: fechaSalida,
        },
        documentoIdentidadUri,
        documentoIdentidadType,
        justificativo.uri,
        justificativo.type,
      );

      if (error || !data) {
        onError?.(error ?? "Error al enviar la solicitud.");
        Alert.alert("Error", error ?? "No se pudo crear la solicitud. Inténtalo de nuevo.");
        return;
      }

      setEsperando(true);
      onCompleted(data.id);
    } finally {
      setEnviando(false);
    }
  }

  if (solicitudRechazada) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-rose-100">
          <XCircle size={48} color="#f43f5e" />
        </View>
        <Text className="text-center text-xl font-bold text-slate-900 mb-3">
          Solicitud rechazada
        </Text>
        {motivoRechazo ? (
          <View className="w-full bg-rose-50 rounded-2xl p-4 mb-5">
            <Text className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-1">Motivo del rechazo</Text>
            <Text className="text-sm text-rose-800 leading-5">{motivoRechazo}</Text>
          </View>
        ) : (
          <Text className="text-center text-sm text-slate-500 mb-5">
            El propietario no ha podido aceptar tu solicitud.
          </Text>
        )}
        <View className="w-full gap-3">
          <View className="bg-slate-50 rounded-2xl p-4">
            <Text className="text-xs text-slate-500 leading-4">
              Puedes buscar otras viviendas disponibles o contactar con el propietario para más información.
            </Text>
          </View>
          <Pressable
            onPress={() => { /* Parent manejará la navegación */ }}
            className="flex-row items-center justify-center rounded-2xl bg-indigo-500 py-4 gap-2 active:bg-indigo-600"
          >
            <Search size={18} color="#ffffff" />
            <Text className="text-base font-semibold text-white">Buscar otras viviendas</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (esperando) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
          <CheckCircle size={48} color="#6366f1" />
        </View>
        <Text className="text-center text-xl font-bold text-slate-900 mb-3">
          Solicitud enviada
        </Text>
        <Text className="text-center text-sm text-slate-500 leading-5 mb-6">
          Tu solicitud está siendo revisada por el propietario.{"\n"}
          Te notificaremos cuando responda.
        </Text>
        <View className="w-full bg-slate-50 rounded-2xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <ActivityIndicator size="small" color="#6366f1" />
            <Text className="text-sm font-medium text-slate-700">Esperando respuesta del propietario…</Text>
          </View>
          <Text className="text-xs text-slate-400">La pantalla avanzará automáticamente cuando sea aceptada.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* Resumen de fechas */}
      <View className="bg-indigo-50 rounded-2xl p-4 mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Calendar size={18} color="#6366f1" />
          <Text className="text-sm font-semibold text-indigo-800">Periodo de estancia</Text>
        </View>
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-indigo-600">Entrada</Text>
            <Text className="text-sm font-bold text-indigo-900">{formatDate(fechaEntrada)}</Text>
          </View>
          <View className="items-center">
            <Text className="text-xs text-indigo-400">→</Text>
            <Text className="text-xs text-indigo-600">{mesesEstancia} {mesesEstancia === 1 ? "mes" : "meses"}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-indigo-600">Salida</Text>
            <Text className="text-sm font-bold text-indigo-900">{formatDate(fechaSalida)}</Text>
          </View>
        </View>
      </View>

      {/* Selector de motivo */}
      <Text className="text-sm font-semibold text-slate-700 mb-3">Motivo de la estancia</Text>
      <View className="gap-3 mb-6">
        {MOTIVOS.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => setMotivo(m.value)}
            className={`rounded-2xl p-4 border-2 ${
              motivo === m.value
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${motivo === m.value ? "text-indigo-700" : "text-slate-800"}`}>
                  {m.label}
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">{m.descripcion}</Text>
              </View>
              <View className={`w-5 h-5 rounded-full border-2 ml-3 items-center justify-center ${motivo === m.value ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`}>
                {motivo === m.value && <View className="w-2 h-2 rounded-full bg-white" />}
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Detalle si es "Otros" */}
      {motivo === "Otros" && (
        <View className="mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-2">Describe brevemente el motivo</Text>
          <TextInput
            value={motivoDetalle}
            onChangeText={setMotivoDetalle}
            placeholder="Ej: Obras en mi vivienda habitual..."
            multiline
            numberOfLines={3}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            style={{ textAlignVertical: "top", minHeight: 80 }}
          />
        </View>
      )}

      {/* Upload justificativo */}
      <Text className="text-sm font-semibold text-slate-700 mb-2">
        {motivo === "Estudios"
          ? "Matrícula o justificante de estudios"
          : motivo === "Trabajo temporal"
          ? "Contrato laboral o justificante de trabajo"
          : "Documento justificativo"}
      </Text>
      <Pressable
        onPress={seleccionarJustificativo}
        className={`border-2 border-dashed rounded-2xl p-5 items-center justify-center mb-6 ${
          justificativo ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white"
        }`}
      >
        {justificativo ? (
          <>
            <CheckCircle size={28} color="#10b981" />
            <Text className="mt-2 text-sm font-semibold text-emerald-700">{justificativo.nombre}</Text>
            <Text className="text-xs text-emerald-600 mt-1">Toca para cambiar</Text>
          </>
        ) : (
          <>
            <Upload size={28} color="#94a3b8" />
            <Text className="mt-2 text-sm font-semibold text-slate-600">Subir documento</Text>
            <Text className="text-xs text-slate-400 mt-1">PDF o imagen</Text>
          </>
        )}
      </Pressable>

      {/* Info */}
      <View className="flex-row items-start gap-2 bg-amber-50 rounded-xl p-3 mb-6">
        <AlertCircle size={16} color="#f59e0b" />
        <Text className="flex-1 text-xs text-amber-700 leading-4">
          El propietario revisará tu solicitud. Una vez aceptada, podrás firmar el contrato y realizar el pago.
        </Text>
      </View>

      {/* Botón enviar */}
      <Pressable
        onPress={enviarSolicitud}
        disabled={enviando || !motivo || !justificativo}
        className={`flex-row items-center justify-center rounded-2xl py-4 px-6 ${
          enviando || !motivo || !justificativo
            ? "bg-slate-200"
            : "bg-indigo-500 active:bg-indigo-600"
        }`}
      >
        {enviando ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <FileText size={20} color={!motivo || !justificativo ? "#94a3b8" : "#ffffff"} />
            <Text className={`ml-2 text-base font-semibold ${!motivo || !justificativo ? "text-slate-400" : "text-white"}`}>
              Enviar solicitud
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

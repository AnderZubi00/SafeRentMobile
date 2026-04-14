import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import NfcManager from "react-native-nfc-manager";
import {
  Camera,
  RotateCcw,
  CheckCircle,
  XCircle,
  Shield,
  SwitchCamera,
  Wifi,
  AlertCircle,
} from "lucide-react-native";
import {
  crearSesionKyc,
  analizarDocumentoCompleto,
  actualizarEstadoKycMovil,
  type AnalisisOCRResponse,
} from "@/lib/kyc";
import { verifyPassportNfc, type NfcPassportResult } from "@/lib/nfc-passport";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type EstadoKyc =
  | "verificando_usuario"
  | "camera_front"
  | "camera_back"
  | "analyzing"
  | "nfc_position"
  | "nfc_reading"
  | "nfc_success"
  | "success"
  | "error";

type CameraFacing = "front" | "back";

export interface KycResult {
  documentoIdentidadUri: string;
  documentoIdentidadType: string;
  safeScore: number;
}

interface Props {
  verificadoKyc: boolean;
  onCompleted: (result: KycResult) => void;
  onError?: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function calcularScoreFinal(ocrScore: number, nfcExitoso: boolean): number {
  return Math.min(Math.min(ocrScore, 75) + (nfcExitoso ? 20 : 0), 95);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function StepKyc({ verificadoKyc, onCompleted, onError }: Props) {
  const [estado, setEstado] = useState<EstadoKyc>(
    verificadoKyc ? "verificando_usuario" : "verificando_usuario"
  );
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [nfcSoportado, setNfcSoportado] = useState<boolean | null>(null);
  const [nfcIntentos, setNfcIntentos] = useState(0);
  const [nfcMensaje, setNfcMensaje] = useState<string | null>(null);
  const [frenteUri, setFrenteUri] = useState<string | null>(null);
  const [safeScore, setSafeScore] = useState<number | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const ocrResultRef = useRef<AnalisisOCRResponse | null>(null);
  const nfcRetriesRef = useRef(0);
  const mrzRescansRef = useRef(0);
  const nfcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soporteConfiableRef = useRef<string | null>(null);
  const dobConfiableRef = useRef<string | null>(null);
  const expiryConfiableRef = useRef<string | null>(null);
  const rawExpiryRef = useRef<string | null>(null);
  const frenteUriRef = useRef<string | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (estado === "success" || estado === "nfc_success") {
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [estado, scaleAnim]);

  // Fallback cameraReady para camera_back
  useEffect(() => {
    if (estado !== "camera_back" || cameraReady) return;
    const t = setTimeout(() => setCameraReady(true), 2000);
    return () => clearTimeout(t);
  }, [estado, cameraReady]);

  // Inicializar NFC
  useEffect(() => {
    let mounted = true;
    async function initNfc() {
      const supported = await NfcManager.isSupported();
      if (supported) { try { await NfcManager.start(); } catch { /* ya iniciado */ } }
      if (mounted) setNfcSoportado(supported);
    }
    initNfc().catch(() => { if (mounted) setNfcSoportado(false); });
    return () => {
      mounted = false;
      if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current);
    };
  }, []);

  // Iniciar flujo siempre — incluso si ya está verificado se necesita
  // la foto del DNI como documento_identidad_url para la solicitud
  useEffect(() => {
    iniciarFlujo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciarFlujo() {
    const { data, error } = await crearSesionKyc();
    if (error || !data) {
      setMensajeError("No se pudo iniciar la verificación. Comprueba tu conexión.");
      setEstado("error");
      return;
    }
    setToken(data.token);

    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permiso denegado", "Necesitamos acceso a la cámara para verificar tu identidad.");
        setEstado("error");
        setMensajeError("Permiso de cámara denegado.");
        return;
      }
    }
    setEstado("camera_front");
  }

  const completar = useCallback(
    async (ocr: AnalisisOCRResponse, nfcExitoso: boolean, intentosNfc: number) => {
      if (!token) return;
      const finalScore = calcularScoreFinal(ocr.safe_score, nfcExitoso);

      await actualizarEstadoKycMovil({
        token,
        estado: "COMPLETADO",
        safe_score: finalScore,
        nfc_verificado: nfcExitoso,
        nombre_extraido: ocr.datos_extraidos.nombre,
        apellidos_extraidos: ocr.datos_extraidos.apellidos,
        dni_extraido: ocr.datos_extraidos.numero_documento,
        tipo_documento: ocr.tipo_documento,
        datos_raw: { ocr, nfc: { exitoso: nfcExitoso, intentos: intentosNfc } },
      });

      setSafeScore(finalScore);
      setEstado("success");

      const uri = frenteUriRef.current ?? "";
      onCompleted({ documentoIdentidadUri: uri, documentoIdentidadType: "image/jpeg", safeScore: finalScore });
    },
    [token, onCompleted]
  );

  const saltarNfc = useCallback(() => {
    if (nfcTimeoutRef.current) { clearTimeout(nfcTimeoutRef.current); nfcTimeoutRef.current = null; }
    const ocr = ocrResultRef.current;
    if (ocr) completar(ocr, false, nfcRetriesRef.current);
  }, [completar]);

  const intentarNfc = useCallback(async () => {
    const ocr = ocrResultRef.current;
    if (!ocr) return;
    nfcRetriesRef.current += 1;
    setNfcIntentos(nfcRetriesRef.current);
    setEstado("nfc_reading");
    setNfcMensaje(null);

    const documentNumber = soporteConfiableRef.current || ocr.datos_extraidos.numero_soporte || ocr.datos_extraidos.numero_documento || "";
    const dateOfBirth = dobConfiableRef.current || ocr.datos_extraidos.fecha_nacimiento || "";
    const dateOfExpiry = expiryConfiableRef.current || ocr.datos_extraidos.fecha_expiracion || "";

    const timeout = new Promise<NfcPassportResult>((resolve) => {
      const id = setTimeout(async () => {
        nfcTimeoutRef.current = null;
        try { await NfcManager.cancelTechnologyRequest(); } catch { /* ignorar */ }
        await new Promise((r) => setTimeout(r, 300));
        resolve({ success: false, error: "Tiempo agotado — acercá más el DNI al teléfono", intentos: nfcRetriesRef.current });
      }, 30_000);
      nfcTimeoutRef.current = id;
    });

    let result = await Promise.race([verifyPassportNfc({ documentNumber, dateOfBirth, dateOfExpiry }), timeout]);
    if (nfcTimeoutRef.current) { clearTimeout(nfcTimeoutRef.current); nfcTimeoutRef.current = null; }

    if (!result.success && result.redirectTo === "mrz_scan" && rawExpiryRef.current && rawExpiryRef.current !== dateOfExpiry) {
      result = await verifyPassportNfc({ documentNumber, dateOfBirth, dateOfExpiry: rawExpiryRef.current });
    }

    if (!result.success && result.redirectTo === "mrz_scan") {
      mrzRescansRef.current += 1;
      if (mrzRescansRef.current <= 1) {
        setNfcMensaje(result.error ?? null);
        setCameraReady(false);
        setEstado("camera_back");
        return;
      }
    }

    if (result.success) {
      setEstado("nfc_success");
      setTimeout(() => completar(ocr, true, result.intentos), 1500);
    } else {
      setNfcMensaje(result.error ?? null);
      if (nfcRetriesRef.current < 3) setEstado("nfc_position");
      else await completar(ocr, false, result.intentos);
    }
  }, [completar]);

  const capturarAnverso = useCallback(async () => {
    if (!cameraRef.current) return;
    setMensajeError(null);
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!foto?.uri) throw new Error("No se pudo capturar la imagen");
      frenteUriRef.current = foto.uri;
      setFrenteUri(foto.uri);
      setCameraReady(false);
      setEstado("camera_back");
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : "Error al capturar.");
      setEstado("error");
    }
  }, []);

  const capturarReversoYAnalizar = useCallback(async () => {
    if (!cameraRef.current || !frenteUri) return;
    setMensajeError(null);
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!foto?.uri) throw new Error("No se pudo capturar el reverso");
      setEstado("analyzing");

      const [frenteResp, reversoResp] = await Promise.all([fetch(frenteUri), fetch(foto.uri)]);
      const [frenteBlob, reversoBlob] = await Promise.all([frenteResp.blob(), reversoResp.blob()]);
      const [frenteBase64, reversoBase64] = await Promise.all([blobToBase64(frenteBlob), blobToBase64(reversoBlob)]);

      const { data: ocr, error } = await analizarDocumentoCompleto(frenteBase64, reversoBase64);

      if (error || !ocr) {
        setMensajeError("Error al analizar el documento. Inténtalo de nuevo.");
        setEstado("error");
        return;
      }

      if (ocr.recomendacion === "RECHAZAR") {
        if (token) await actualizarEstadoKycMovil({ token, estado: "FALLIDO", datos_raw: { ocr } });
        setMensajeError("No se pudo verificar el documento. Asegúrate de fotografiar bien ambas caras.");
        setEstado("error");
        return;
      }

      ocrResultRef.current = ocr;
      nfcRetriesRef.current = 0;
      mrzRescansRef.current = 0;

      const mrzDebug = (ocr as unknown as {
        mrz_debug?: { soporteValid?: boolean; dobValid?: boolean; expiryValid?: boolean; dob?: string; expiry?: string; rawExpiry?: string }
      }).mrz_debug;
      if (ocr.datos_extraidos.numero_soporte && mrzDebug?.soporteValid) soporteConfiableRef.current = ocr.datos_extraidos.numero_soporte;
      if (mrzDebug?.dobValid && mrzDebug.dob) dobConfiableRef.current = mrzDebug.dob;
      if (mrzDebug?.expiryValid && mrzDebug.expiry) expiryConfiableRef.current = mrzDebug.expiry;
      if (mrzDebug?.rawExpiry) rawExpiryRef.current = mrzDebug.rawExpiry;

      const canNfc = nfcSoportado &&
        (soporteConfiableRef.current || ocr.datos_extraidos.numero_soporte) &&
        ocr.datos_extraidos.fecha_nacimiento &&
        ocr.datos_extraidos.fecha_expiracion;

      if (canNfc) setEstado("nfc_position");
      else await completar(ocr, false, 0);
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : "Error de conexión.");
      setEstado("error");
    }
  }, [frenteUri, nfcSoportado, token, completar]);

  // ---------------------------------------------------------------------------
  // Renders
  // ---------------------------------------------------------------------------

  if (estado === "verificando_usuario") {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-slate-500">Iniciando verificación...</Text>
        {verificadoKyc && (
          <Text className="mt-2 text-xs text-center text-emerald-600 px-4">
            Tu identidad ya fue verificada.{"\n"}Solo necesitas escanear tu DNI para esta reserva.
          </Text>
        )}
      </View>
    );
  }

  if (estado === "camera_front") {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={[]}>
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          <View className="absolute inset-0 justify-center items-center">
            <View className="absolute top-8 left-0 right-0 items-center px-4">
              <Text className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full text-center">
                Buena iluminación · Documento completo · Sin reflejos
              </Text>
            </View>
            <View className="border-2 border-dashed border-white/70 rounded-2xl items-center justify-center" style={{ width: 300, height: 190 }}>
              <Text className="text-white/60 text-sm">Coloca el <Text className="font-bold">anverso</Text> de tu DNI aquí</Text>
            </View>
          </View>
          <View className="absolute bottom-10 left-0 right-0 flex-row items-center justify-center gap-8">
            <Pressable onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} className="h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <SwitchCamera size={24} color="#ffffff" />
            </Pressable>
            <Pressable onPress={capturarAnverso} className="h-20 w-20 items-center justify-center rounded-full bg-white border-4 border-white/50 active:bg-slate-200">
              <Camera size={32} color="#0f172a" />
            </Pressable>
            <View className="h-14 w-14" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (estado === "camera_back") {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={[]}>
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" onCameraReady={() => setCameraReady(true)} />
          <View className="absolute inset-0">
            <View className="items-center pt-10 px-4">
              <View className="bg-black/60 rounded-full px-4 py-2">
                <Text className="text-white text-sm font-semibold text-center">Paso 2 — Reverso del DNI</Text>
              </View>
              <Text className="text-white/70 text-xs mt-2 text-center">Enfoca las 3 líneas de código de la franja inferior</Text>
            </View>
            <View className="absolute bottom-40 left-6 right-6">
              <View className="border-2 border-indigo-400/80 rounded-xl items-center justify-center" style={{ height: 80 }}>
                <Text className="text-indigo-300/50 text-xs font-mono tracking-widest">IDESP•••••••••••••••••••••••</Text>
                <Text className="text-indigo-300/70 text-xs font-mono tracking-widest">••••••M••••••ESP•••••••••••</Text>
                <Text className="text-indigo-300/50 text-xs font-mono tracking-widest">APELLIDO••NOMBRE•••••••••••</Text>
              </View>
              <Text className="text-indigo-400 text-xs text-center mt-2">← Zona MRZ aquí</Text>
            </View>
            <View className="absolute bottom-10 left-0 right-0 items-center">
              <Pressable onPress={capturarReversoYAnalizar} disabled={!cameraReady}
                className={`h-20 w-20 items-center justify-center rounded-full border-4 ${cameraReady ? "bg-indigo-500 border-indigo-300/50 active:bg-indigo-600" : "bg-slate-600 border-slate-500"}`}>
                <Camera size={32} color="#ffffff" />
              </Pressable>
              <Text className="text-white/60 text-xs mt-3">{cameraReady ? "Toca para analizar" : "Iniciando cámara..."}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (estado === "analyzing") {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-base font-medium text-slate-700">Analizando documento...</Text>
        <Text className="mt-2 text-center text-sm text-slate-400">GPT-4o verifica ambas caras del DNI.{"\n"}Esto puede tardar unos segundos.</Text>
      </View>
    );
  }

  if (estado === "nfc_position") {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center px-8">
        <View className="mb-8 items-center">
          <View className="w-32 h-48 rounded-2xl border-2 border-indigo-400 items-center justify-center mb-2 bg-slate-800">
            <Wifi size={32} color="#6366f1" />
            <Text className="text-indigo-400 text-xs mt-2 text-center px-2">Chip NFC{"\n"}(parte sup.)</Text>
          </View>
          <View className="w-48 h-12 rounded-xl border-2 border-slate-500 items-center justify-center bg-slate-700">
            <Text className="text-slate-400 text-xs">Parte trasera del teléfono</Text>
          </View>
        </View>
        <Text className="text-center text-xl font-bold text-white mb-3">Paso 3 — Leer el chip NFC</Text>
        <Text className="text-center text-sm text-slate-300 leading-5 mb-6">
          Pega el <Text className="text-indigo-400 font-semibold">reverso del DNI</Text> contra la parte trasera del teléfono
        </Text>
        {nfcMensaje && (
          <View className="mb-4 flex-row items-start gap-2 bg-amber-500/20 rounded-xl px-4 py-3 w-full">
            <AlertCircle size={16} color="#f59e0b" />
            <Text className="flex-1 text-sm text-amber-300">{nfcMensaje}</Text>
          </View>
        )}
        {nfcIntentos > 0 && <Text className="mb-4 text-xs text-slate-500">Intento {nfcIntentos} de 3</Text>}
        <View className="gap-3 w-full">
          <Pressable onPress={intentarNfc} className="flex-row items-center justify-center rounded-xl bg-indigo-500 px-6 py-4 active:bg-indigo-600">
            <Wifi size={20} color="#ffffff" />
            <Text className="ml-2 text-base font-semibold text-white">Ya posicionado — Leer chip</Text>
          </Pressable>
          <Pressable onPress={saltarNfc} className="flex-row items-center justify-center rounded-xl border border-slate-700 px-6 py-3">
            <Text className="text-sm text-slate-400">Saltar — verificar solo con la foto</Text>
          </Pressable>
        </View>
        <PrivacyNotice dark />
      </View>
    );
  }

  if (estado === "nfc_reading") {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center px-8">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-6 text-base font-medium text-white">Leyendo chip…</Text>
        <Text className="mt-2 text-sm text-slate-400">No retires el DNI del teléfono</Text>
        <Pressable onPress={saltarNfc} className="mt-10 px-6 py-3 rounded-full border border-slate-600 active:bg-slate-800">
          <Text className="text-sm text-slate-400">Saltar verificación NFC</Text>
        </Pressable>
      </View>
    );
  }

  if (estado === "nfc_success") {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center px-8">
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }} className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20">
          <CheckCircle size={48} color="#6366f1" />
        </Animated.View>
        <Text className="text-center text-xl font-bold text-white">¡Chip verificado!</Text>
        <Text className="mt-2 text-sm text-slate-400">Completando verificación…</Text>
      </View>
    );
  }

  if (estado === "success") {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }} className="mb-6 h-28 w-28 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle size={64} color="#10b981" />
        </Animated.View>
        <Text className="text-center text-2xl font-bold text-slate-900">Identidad verificada</Text>
        {safeScore !== null && (
          <View className="mt-4 bg-emerald-50 rounded-2xl px-6 py-3">
            <Text className="text-center text-sm text-emerald-700 font-medium">SafeScore: {safeScore}/95</Text>
          </View>
        )}
        <Text className="mt-4 text-center text-sm text-slate-400">Continuando con tu reserva…</Text>
        <PrivacyNotice />
      </View>
    );
  }

  if (estado === "error") {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-rose-100">
          <XCircle size={48} color="#f43f5e" />
        </View>
        <Text className="mb-2 text-center text-lg font-bold text-slate-900">No se pudo verificar</Text>
        <Text className="mb-8 text-center text-sm leading-5 text-slate-500">{mensajeError ?? "Ocurrió un error inesperado."}</Text>
        <Pressable className="w-full flex-row items-center justify-center rounded-xl bg-indigo-500 px-6 py-4 active:bg-indigo-600"
          onPress={() => { setMensajeError(null); iniciarFlujo(); }}>
          <RotateCcw size={20} color="#ffffff" />
          <Text className="ml-3 text-base font-semibold text-white">Intentar de nuevo</Text>
        </Pressable>
        <PrivacyNotice />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

function PrivacyNotice({ dark = false }: { dark?: boolean }) {
  return (
    <View className="flex-row items-start px-5 pb-4 pt-2 mt-4">
      <Shield size={16} color="#64748b" />
      <Text className={`ml-2 flex-1 text-xs leading-4 ${dark ? "text-slate-600" : "text-slate-400"}`}>
        Tu documento se procesa de forma segura y no se almacena permanentemente.
      </Text>
    </View>
  );
}

import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import NfcManager from "react-native-nfc-manager";
import {
  Camera,
  RotateCcw,
  CheckCircle,
  XCircle,
  Shield,
  Hash,
  SwitchCamera,
  Wifi,
  AlertCircle,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { verifyPassportNfc, type NfcPassportResult } from "@/lib/nfc-passport";

const WEB_API_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Estado =
  | "idle"
  | "validating"
  | "camera_front"
  | "camera_back"
  | "analyzing"
  | "nfc_position"
  | "nfc_reading"
  | "nfc_success"
  | "success"
  | "error";

type CameraFacing = "front" | "back";

interface OcrResult {
  recomendacion: "APROBAR" | "RECHAZAR" | "REVISAR_MANUAL";
  safe_score: number;
  datos_extraidos: {
    nombre: string;
    apellidos: string;
    numero_documento: string;
    numero_soporte: string;
    fecha_nacimiento: string;
    fecha_expiracion: string;
  };
  tipo_documento: string;
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function calcularScoreFinal(ocrScore: number, nfcExitoso: boolean): number {
  const base = Math.min(ocrScore, 75);
  const bonus = nfcExitoso ? 20 : 0;
  return Math.min(base + bonus, 95);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KycMovilScreen() {
  const { token: tokenParam, sesion: sesionParam } = useLocalSearchParams<{
    token: string;
    sesion: string;
  }>();

  const [tokenManual, setTokenManual] = useState("");
  const [sesionManual, setSesionManual] = useState("");
  const token = tokenParam || tokenManual || null;
  const sesionId = sesionParam || sesionManual || null;

  const [estado, setEstado] = useState<Estado>("idle");
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [safeScore, setSafeScore] = useState<number | null>(null);
  const [nfcVerificado, setNfcVerificado] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>("back");
  const [nfcSoportado, setNfcSoportado] = useState<boolean | null>(null);
  const [nfcIntentos, setNfcIntentos] = useState(0);
  const [nfcMensaje, setNfcMensaje] = useState<string | null>(null);
  const [frenteUri, setFrenteUri] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const ocrResultRef = useRef<OcrResult | null>(null);
  const ocrFrontRef = useRef<OcrResult | null>(null);
  const nfcRetriesRef = useRef(0);
  const mrzRescansAfter6300Ref = useRef(0);
  const nfcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Preserva los mejores campos MRZ conocidos entre rescans (validados por dígito verificador)
  const soporteConfiableRef = useRef<string | null>(null);
  const dobConfiableRef = useRef<string | null>(null);
  const expiryConfiableRef = useRef<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Success animation
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (estado === "success" || estado === "nfc_success") {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [estado, scaleAnim]);

  // Fallback: si onCameraReady no dispara en 2s, habilitamos igual
  useEffect(() => {
    if (estado !== "camera_back" || cameraReady) return;
    const timer = setTimeout(() => setCameraReady(true), 2000);
    return () => clearTimeout(timer);
  }, [estado, cameraReady]);

  // Check NFC support on mount and initialize (once)
  useEffect(() => {
    let mounted = true;
    async function initNfc() {
      const supported = await NfcManager.isSupported();
      if (supported) {
        try { await NfcManager.start(); } catch { /* already started */ }
      }
      if (mounted) setNfcSoportado(supported);
    }
    initNfc().catch(() => { if (mounted) setNfcSoportado(false); });
    return () => {
      mounted = false;
      // Solo limpiar el timeout — NO llamar cancelTechnologyRequest en unmount
      // porque si no hay sesión activa corrompe el estado nativo de Android
      if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Completar sesión en Supabase
  // ---------------------------------------------------------------------------
  const completar = useCallback(
    async (ocr: OcrResult, nfcExitoso: boolean, intentosNfc: number) => {
      const finalScore = calcularScoreFinal(ocr.safe_score, nfcExitoso);
      const { datos_extraidos } = ocr;

      await supabase
        .from("kyc_sesiones")
        .update({
          estado: "COMPLETADO",
          safe_score: finalScore,
          nfc_verificado: nfcExitoso,
          nombre_extraido: datos_extraidos.nombre,
          apellidos_extraidos: datos_extraidos.apellidos,
          dni_extraido: datos_extraidos.numero_documento,
          tipo_documento: ocr.tipo_documento,
          datos_raw: {
            ocr: ocr,
            nfc_resultado: {
              exitoso: nfcExitoso,
              intentos: intentosNfc,
              ...(!nfcExitoso && { razon: nfcMensaje }),
            },
          },
        })
        .eq("id", sesionId);

      setSafeScore(finalScore);
      setNfcVerificado(nfcExitoso);
      setEstado("success");
    },
    [sesionId, nfcMensaje]
  );

  // ---------------------------------------------------------------------------
  // Saltar NFC — completar con OCR solamente
  // ---------------------------------------------------------------------------
  const saltarNfc = useCallback(() => {
    // Limpiar el timeout — el timeout handler es el único que debe cancelar NFC
    // (cancelTechnologyRequest sin sesión activa corrompe el estado nativo de Android)
    if (nfcTimeoutRef.current) {
      clearTimeout(nfcTimeoutRef.current);
      nfcTimeoutRef.current = null;
    }
    const ocr = ocrResultRef.current ?? ocrFrontRef.current;
    if (ocr) {
      completar(ocr, false, nfcRetriesRef.current);
    }
  }, [completar]);

  // ---------------------------------------------------------------------------
  // Intentar NFC
  // ---------------------------------------------------------------------------
  const intentarNfc = useCallback(async () => {
    const ocr = ocrResultRef.current;
    if (!ocr) return;

    nfcRetriesRef.current += 1;
    setNfcIntentos(nfcRetriesRef.current);
    setEstado("nfc_reading");
    setNfcMensaje(null);

    // Build MRZ fields — campos validados (preservados entre scans) tienen prioridad sobre OCR actual
    const documentNumber =
      soporteConfiableRef.current ||
      ocr.datos_extraidos.numero_soporte ||
      ocr.datos_extraidos.numero_documento ||
      "";
    const dateOfBirth = dobConfiableRef.current || ocr.datos_extraidos.fecha_nacimiento;
    const dateOfExpiry = expiryConfiableRef.current || ocr.datos_extraidos.fecha_expiracion;

    console.log("[NFC BAC] Campos MRZ:", {
      documentNumber,
      dateOfBirth,
      dateOfExpiry,
      soporte_confiable: soporteConfiableRef.current,
      dob_confiable: dobConfiableRef.current,
      expiry_confiable: expiryConfiableRef.current,
    });

    const timeout = new Promise<NfcPassportResult>((resolve) => {
      const id = setTimeout(async () => {
        nfcTimeoutRef.current = null;
        try { await NfcManager.cancelTechnologyRequest(); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 300));
        resolve({ success: false, error: "Tiempo agotado — acercá más el DNI al teléfono", intentos: nfcRetriesRef.current });
      }, 30_000);
      nfcTimeoutRef.current = id;
    });

    const result = await Promise.race([
      verifyPassportNfc({
        documentNumber,
        dateOfBirth,
        dateOfExpiry,
      }),
      timeout,
    ]);

    // Limpiar timeout si el NFC resolvió antes de los 30s
    if (nfcTimeoutRef.current) {
      clearTimeout(nfcTimeoutRef.current);
      nfcTimeoutRef.current = null;
    }

    if (!result.success && result.redirectTo === "mrz_scan") {
      mrzRescansAfter6300Ref.current += 1;
      if (mrzRescansAfter6300Ref.current <= 1) {
        setNfcMensaje(result.error ?? null);
        setCameraReady(false);
        setEstado("camera_back");
        return;
      }
      // Second SW=6300 — show error and allow skip
    }

    if (result.success) {
      setEstado("nfc_success");
      setTimeout(() => completar(ocr, true, result.intentos), 1500);
    } else {
      setNfcMensaje(result.error ?? null);
      if (nfcRetriesRef.current < 3) {
        setEstado("nfc_position");
      } else {
        await completar(ocr, false, result.intentos);
      }
    }
  }, [completar]);

  // ---------------------------------------------------------------------------
  // Validar sesión
  // ---------------------------------------------------------------------------
  const validarSesion = useCallback(async () => {
    if (!token || !sesionId) return;
    setEstado("validating");
    setMensajeError(null);

    try {
      const { data: sesion, error } = await supabase
        .from("kyc_sesiones")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !sesion) {
        setMensajeError("QR caducado o inválido. Genera uno nuevo desde la web.");
        setEstado("error");
        return;
      }

      if (new Date(sesion.expira_en) <= new Date()) {
        setMensajeError("QR caducado. Genera uno nuevo desde la web.");
        setEstado("error");
        return;
      }

      if (sesion.estado === "COMPLETADO") {
        setSafeScore(sesion.safe_score);
        setNfcVerificado(sesion.nfc_verificado ?? false);
        setEstado("success");
        return;
      }

      if (sesion.estado !== "PENDIENTE") {
        setMensajeError("Esta sesión ya fue procesada. Genera un nuevo QR desde la web.");
        setEstado("error");
        return;
      }

      await supabase
        .from("kyc_sesiones")
        .update({ estado: "ESCANEANDO" })
        .eq("id", sesionId);

      if (!permission?.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          Alert.alert(
            "Permiso denegado",
            "Necesitamos acceso a la cámara para capturar tu documento."
          );
          setEstado("idle");
          return;
        }
      }

      setEstado("camera_front");
    } catch (err) {
      setMensajeError("Error de conexión. Verificá tu internet e intentá de nuevo.");
      setEstado("error");
    }
  }, [token, sesionId, permission, requestPermission]);

  // Auto-validate on mount
  useEffect(() => {
    if (token && sesionId && estado === "idle") {
      validarSesion();
    }
  }, [token, sesionId, estado, validarSesion]);

  // ---------------------------------------------------------------------------
  // Capturar y enviar foto
  // ---------------------------------------------------------------------------
  // Paso 1: captura el anverso y va a camera_back
  const capturarYEnviar = useCallback(async () => {
    if (!cameraRef.current) return;
    setMensajeError(null);
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!foto?.uri) throw new Error("No se pudo capturar la imagen");
      setFrenteUri(foto.uri);
      setCameraReady(false);
      setEstado("camera_back");
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : "Error de conexión.");
      setEstado("error");
    }
  }, []);

  // Paso 2: captura el reverso y analiza ambas caras juntas
  const capturarReversoYAnalizar = useCallback(async () => {
    if (!cameraRef.current || !frenteUri) return;
    setMensajeError(null);
    try {
      // Capturar ANTES de cambiar estado — setEstado("analyzing") desmonta el CameraView
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!foto?.uri) throw new Error("No se pudo capturar el reverso");
      setEstado("analyzing");

      const formData = new FormData();
      formData.append("frente", { uri: frenteUri, type: "image/jpeg", name: "frente.jpg" } as unknown as Blob);
      formData.append("reverso", { uri: foto.uri, type: "image/jpeg", name: "reverso.jpg" } as unknown as Blob);

      const respuesta = await fetch(`${WEB_API_URL}/api/kyc/analizar?mode=completo`, {
        method: "POST",
        body: formData,
      });

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        throw new Error(cuerpo?.error ?? `Error del servidor (${respuesta.status})`);
      }

      const ocr: OcrResult & { cd_ok?: boolean } = await respuesta.json();
      console.log("[OCR] Resultado completo:", JSON.stringify({
        cd_ok: ocr.cd_ok,
        datos: ocr.datos_extraidos,
        mrz_debug: (ocr as unknown as { mrz_debug?: unknown }).mrz_debug,
      }));

      if (ocr.recomendacion === "RECHAZAR") {
        await supabase
          .from("kyc_sesiones")
          .update({ estado: "FALLIDO", datos_raw: { ocr } })
          .eq("id", sesionId);
        setMensajeError("No se pudo verificar el documento. Asegurate de fotografiar bien ambas caras.");
        setEstado("error");
        return;
      }

      ocrResultRef.current = ocr;
      ocrFrontRef.current = ocr;
      nfcRetriesRef.current = 0;
      mrzRescansAfter6300Ref.current = 0;

      // Preservar campos MRZ validados por el servidor (dígito verificador ICAO 9303)
      const mrzDebug = (ocr as unknown as {
        mrz_debug?: { soporteValid?: boolean; dobValid?: boolean; expiryValid?: boolean; dob?: string; expiry?: string }
      }).mrz_debug;
      if (ocr.datos_extraidos.numero_soporte && mrzDebug?.soporteValid) {
        soporteConfiableRef.current = ocr.datos_extraidos.numero_soporte;
      }
      if (mrzDebug?.dobValid && mrzDebug.dob) {
        dobConfiableRef.current = mrzDebug.dob;
      }
      if (mrzDebug?.expiryValid && mrzDebug.expiry) {
        expiryConfiableRef.current = mrzDebug.expiry;
      }

      const canNfc = nfcSoportado &&
        (soporteConfiableRef.current || ocr.datos_extraidos.numero_soporte) &&
        ocr.datos_extraidos.fecha_nacimiento &&
        ocr.datos_extraidos.fecha_expiracion;

      if (canNfc) {
        setEstado("nfc_position");
      } else {
        await completar(ocr, false, 0);
      }
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : "Error de conexión.");
      setEstado("error");
    }
  }, [frenteUri, sesionId, nfcSoportado, completar]);


  // ---------------------------------------------------------------------------
  // Render: token/sesion input (Expo Go)
  // ---------------------------------------------------------------------------
  if (!token || !sesionId) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 justify-center px-8">
            <View className="items-center mb-8">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
                <Hash size={36} color="#6366f1" />
              </View>
              <Text className="text-center text-xl font-bold text-slate-900">
                Ingresar datos de verificación
              </Text>
              <Text className="mt-3 text-center text-sm leading-5 text-slate-500">
                Copiá el token y el ID de sesión que aparecen debajo del QR en el navegador.
              </Text>
            </View>

            <Text className="text-xs font-medium text-slate-500 mb-1 ml-1">Token</Text>
            <TextInput
              value={tokenManual}
              onChangeText={setTokenManual}
              placeholder="Pegá el token aquí..."
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-900 mb-3"
              style={{ fontFamily: "monospace" }}
            />

            <Text className="text-xs font-medium text-slate-500 mb-1 ml-1">ID de sesión</Text>
            <TextInput
              value={sesionManual}
              onChangeText={setSesionManual}
              placeholder="Pegá el ID de sesión aquí..."
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-900 mb-4"
              style={{ fontFamily: "monospace" }}
            />

            <Pressable
              className={`flex-row items-center justify-center rounded-xl px-6 py-4 ${
                tokenManual.trim().length > 10 && sesionManual.trim().length > 10
                  ? "bg-indigo-500 active:bg-indigo-600"
                  : "bg-slate-200"
              }`}
              disabled={tokenManual.trim().length <= 10 || sesionManual.trim().length <= 10}
              onPress={() => {
                setTokenManual(tokenManual.trim());
                setSesionManual(sesionManual.trim());
              }}
            >
              <Text
                className={`text-base font-semibold ${
                  tokenManual.trim().length > 10 && sesionManual.trim().length > 10
                    ? "text-white"
                    : "text-slate-400"
                }`}
              >
                Continuar
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Validating
  // ---------------------------------------------------------------------------
  if (estado === "validating") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="mt-4 text-base text-slate-500">Validando sesión...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Camera (front of DNI)
  // ---------------------------------------------------------------------------
  if (estado === "camera_front") {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />

          {/* Overlay — absolute, fuera del CameraView */}
          <View className="absolute inset-0 justify-center items-center">
            <View className="absolute top-8 left-0 right-0 items-center px-4">
              <Text className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full text-center">
                Buena iluminación · Documento completo · Sin reflejos
              </Text>
            </View>

            <View
              className="border-2 border-dashed border-white/70 rounded-2xl items-center justify-center"
              style={{ width: 300, height: 190 }}
            >
              <Text className="text-white/60 text-sm">Coloca el <Text className="font-bold">anverso</Text> de tu DNI aquí</Text>
            </View>
          </View>

          <View className="absolute bottom-10 left-0 right-0 flex-row items-center justify-center gap-8">
            <Pressable
              onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
              className="h-14 w-14 items-center justify-center rounded-full bg-white/20"
            >
              <SwitchCamera size={24} color="#ffffff" />
            </Pressable>

            <Pressable
              onPress={capturarYEnviar}
              className="h-20 w-20 items-center justify-center rounded-full bg-white border-4 border-white/50 active:bg-slate-200"
            >
              <Camera size={32} color="#0f172a" />
            </Pressable>

            <View className="h-14 w-14" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Camera back (reverso del DNI)
  // ---------------------------------------------------------------------------
  if (estado === "camera_back") {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" onCameraReady={() => setCameraReady(true)} />

          {/* Overlay — absolute, fuera del CameraView */}
          <View className="absolute inset-0">
            <View className="items-center pt-10 px-4">
              <View className="bg-black/60 rounded-full px-4 py-2">
                <Text className="text-white text-sm font-semibold text-center">
                  Paso 2 — Reverso del DNI
                </Text>
              </View>
              <Text className="text-white/70 text-xs mt-2 text-center">
                Enfocá las 3 líneas de código de la franja inferior
              </Text>
            </View>

            {/* MRZ guide frame */}
            <View className="absolute bottom-40 left-6 right-6">
              <View className="border-2 border-indigo-400/80 rounded-xl items-center justify-center" style={{ height: 80 }}>
                <Text className="text-indigo-300/50 text-xs font-mono tracking-widest">IDESP•••••••••••••••••••••••</Text>
                <Text className="text-indigo-300/70 text-xs font-mono tracking-widest">••••••M••••••ESP•••••••••••</Text>
                <Text className="text-indigo-300/50 text-xs font-mono tracking-widest">APELLIDO••NOMBRE•••••••••••</Text>
              </View>
              <Text className="text-indigo-400 text-xs text-center mt-2">← Zona MRZ aquí</Text>
            </View>

            <View className="absolute bottom-10 left-0 right-0 items-center">
              <Pressable
                onPress={capturarReversoYAnalizar}
                disabled={!cameraReady}
                className={`h-20 w-20 items-center justify-center rounded-full border-4 ${cameraReady ? "bg-indigo-500 border-indigo-300/50 active:bg-indigo-600" : "bg-slate-600 border-slate-500"}`}
              >
                <Camera size={32} color="#ffffff" />
              </Pressable>
              <Text className="text-white/60 text-xs mt-3">
                {cameraReady ? "Toca para analizar ambas caras" : "Iniciando cámara..."}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Analyzing (ambas caras)
  // ---------------------------------------------------------------------------
  if (estado === "analyzing") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="mt-4 text-base font-medium text-slate-700">
            Analizando documento...
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-400">
            GPT-4o verifica ambas caras del DNI.{"\n"}Esto puede tardar unos segundos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // NFC position
  // ---------------------------------------------------------------------------
  if (estado === "nfc_position") {
    return (
      <SafeAreaView className="flex-1 bg-slate-950">
        <View className="flex-1 items-center justify-center px-8">
          {/* Visual diagram */}
          <View className="mb-8 items-center">
            <View className="w-32 h-48 rounded-2xl border-2 border-indigo-400 items-center justify-center mb-2 bg-slate-800">
              <Wifi size={32} color="#6366f1" />
              <Text className="text-indigo-400 text-xs mt-2 text-center px-2">Chip NFC{"\n"}(parte sup.)</Text>
            </View>
            <View className="w-48 h-12 rounded-xl border-2 border-slate-500 items-center justify-center bg-slate-700">
              <Text className="text-slate-400 text-xs">Parte trasera del teléfono</Text>
            </View>
          </View>

          <Text className="text-center text-xl font-bold text-white mb-3">
            Paso 3 — Leer el chip NFC
          </Text>
          <Text className="text-center text-sm text-slate-300 leading-5 mb-2">
            Pegá el <Text className="text-indigo-400 font-semibold">reverso del DNI</Text> contra la parte trasera del teléfono y mantelo <Text className="text-white font-semibold">quieto</Text>
          </Text>
          <Text className="text-center text-xs text-slate-500 mb-6">
            El chip está en la esquina superior del documento
          </Text>

          {nfcMensaje && (
            <View className="mb-4 flex-row items-start gap-2 bg-amber-500/20 rounded-xl px-4 py-3 w-full">
              <AlertCircle size={16} color="#f59e0b" />
              <Text className="flex-1 text-sm text-amber-300">{nfcMensaje}</Text>
            </View>
          )}

          {nfcIntentos > 0 && (
            <Text className="mb-4 text-xs text-slate-500">
              Intento {nfcIntentos} de 3
            </Text>
          )}

          <View className="gap-3 w-full">
            <Pressable
              onPress={intentarNfc}
              className="flex-row items-center justify-center rounded-xl bg-indigo-500 px-6 py-4 active:bg-indigo-600"
            >
              <Wifi size={20} color="#ffffff" />
              <Text className="ml-2 text-base font-semibold text-white">
                Ya lo tengo posicionado — Leer chip
              </Text>
            </Pressable>
            <Pressable
              onPress={saltarNfc}
              className="flex-row items-center justify-center rounded-xl border border-slate-700 px-6 py-3"
            >
              <Text className="text-sm text-slate-400">Saltar — verificar solo con la foto</Text>
            </Pressable>
          </View>
        </View>
        <PrivacyNotice dark />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // NFC reading
  // ---------------------------------------------------------------------------
  if (estado === "nfc_reading") {
    return (
      <SafeAreaView className="flex-1 bg-slate-950">
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="mt-6 text-base font-medium text-white">
            Leyendo chip…
          </Text>
          <Text className="mt-2 text-sm text-slate-400">
            No retires el DNI del teléfono
          </Text>
          <Pressable
            onPress={saltarNfc}
            className="mt-10 px-6 py-3 rounded-full border border-slate-600 active:bg-slate-800"
          >
            <Text className="text-sm text-slate-400">Saltar verificación NFC</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // NFC success (brief intermediate screen)
  // ---------------------------------------------------------------------------
  if (estado === "nfc_success") {
    return (
      <SafeAreaView className="flex-1 bg-slate-950">
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View
            style={{ transform: [{ scale: scaleAnim }] }}
            className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20"
          >
            <CheckCircle size={48} color="#6366f1" />
          </Animated.View>
          <Text className="text-center text-xl font-bold text-white">
            ¡Chip verificado!
          </Text>
          <Text className="mt-2 text-sm text-slate-400">Calculando puntuación final…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  if (estado === "success") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View
            style={{ transform: [{ scale: scaleAnim }] }}
            className="mb-6 h-28 w-28 items-center justify-center rounded-full bg-emerald-100"
          >
            <CheckCircle size={64} color="#10b981" />
          </Animated.View>
          <Text className="text-center text-2xl font-bold text-slate-900">
            ¡Documento verificado!
          </Text>

          {safeScore !== null && (
            <View className="mt-5 items-center">
              <Text className="text-5xl font-bold text-emerald-600">{safeScore}</Text>
              <Text className="text-sm text-slate-500 mt-1">SafeScore</Text>
            </View>
          )}

          {nfcVerificado && (
            <View className="mt-4 flex-row items-center gap-2 bg-indigo-50 rounded-full px-4 py-2">
              <Wifi size={14} color="#6366f1" />
              <Text className="text-xs font-medium text-indigo-700">
                Chip NFC verificado
              </Text>
            </View>
          )}

          <Text className="mt-6 text-center text-base font-medium text-slate-700">
            ¡Listo! Volvé al ordenador para continuar con tu reserva.
          </Text>
        </View>
        <PrivacyNotice />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------
  if (estado === "error") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-rose-100">
            <XCircle size={48} color="#f43f5e" />
          </View>
          <Text className="mb-2 text-center text-lg font-bold text-slate-900">
            No se pudo verificar
          </Text>
          <Text className="mb-8 text-center text-sm leading-5 text-slate-500">
            {mensajeError ?? "Ocurrió un error inesperado. Por favor intentá de nuevo."}
          </Text>
          <Pressable
            className="w-full flex-row items-center justify-center rounded-xl bg-indigo-500 px-6 py-4 active:bg-indigo-600"
            onPress={() => {
              setMensajeError(null);
              setEstado("camera_front");
            }}
          >
            <RotateCcw size={20} color="#ffffff" />
            <Text className="ml-3 text-base font-semibold text-white">
              Intentar de nuevo
            </Text>
          </Pressable>
        </View>
        <PrivacyNotice />
      </SafeAreaView>
    );
  }

  // Idle / fallback
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PrivacyNotice({ dark = false }: { dark?: boolean }) {
  return (
    <View className="flex-row items-start px-5 pb-4 pt-2">
      <Shield size={16} color={dark ? "#64748b" : "#64748b"} />
      <Text className={`ml-2 flex-1 text-xs leading-4 ${dark ? "text-slate-600" : "text-slate-400"}`}>
        Tu documento se procesa de forma segura y no se almacena permanentemente.
      </Text>
    </View>
  );
}

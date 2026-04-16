import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getBackendToken } from "@/lib/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Hook para suscribirse a eventos WebSocket del backend (namespace /notifications).
 * En móvil autenticamos vía Bearer header en el handshake (no cookies).
 *
 * @param events  Map de nombre de evento → handler
 * @param enabled Si es false, no se conecta (útil para condicionar por auth)
 *
 * @example
 * useNotifications({
 *   solicitud_aceptada: (data) => { ... },
 *   pago_recibido: (data) => { ... },
 * }, !!usuario);
 */
export function useNotifications(
  events: Record<string, (data: unknown) => void>,
  enabled = true
) {
  const socketRef = useRef<Socket | null>(null);
  // Guardamos referencia a los handlers para evitar reconexiones en re-renders
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let socket: Socket;

    async function conectar() {
      const token = await getBackendToken();
      if (cancelled) return;

      socket = io(`${API_URL}/notifications`, {
        transports: ["websocket"],
        auth: token ? { token } : undefined,
        extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      socketRef.current = socket;

      for (const [event, handler] of Object.entries(eventsRef.current)) {
        socket.on(event, handler);
      }
    }

    conectar();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [enabled]); // Solo reconectar si cambia enabled
}

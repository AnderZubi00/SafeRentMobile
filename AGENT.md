# AGENT.md — SafeRent Skill Orchestrator

Sistema de orquestación de Skills con Lazy Loading para evitar Context Overload.
Lee **solo los skills activados** por el contexto de la tarea.

---

## Reglas de Activación de Skills (Lazy Loading)

| Contexto de la tarea | Skills a cargar |
|---|---|
| Flujo de alquiler (solicitudes, contratos, pagos) | `.agent/skills/rental-flow.skill.md` |
| Verificación de identidad / KYC / cámara | `.agent/skills/kyc-verification.skill.md` |
| NFC, chip DNI, ICAO, BAC, MRZ, kMRZ, ePassport, pasaporte electrónico | `.agent/skills/nfc-passport.skill.md` |
| KYC + NFC (lectura de chip durante verificación de identidad) | `.agent/skills/kyc-verification.skill.md` + `.agent/skills/nfc-passport.skill.md` |
| Componentes UI, diseño, pantallas, estilos | `.agent/skills/nativewind-ui.skill.md` |
| Navegación, rutas, layouts, tab guards | `.agent/skills/navigation.skill.md` |
| Queries Supabase, RLS, storage, migraciones | `.agent/skills/supabase-data.skill.md` |

**Regla**: No cargues todos los skills al inicio. Identifica el dominio de la tarea → carga solo los skills relevantes → ejecuta.

---

## Reglas de Flujo de Trabajo

### Plan Mode
SIEMPRE entra en Plan Mode (`/plan`) antes de implementar:
- Flujos de navegación con múltiples pantallas
- Cambios que afecten a más de un Context provider
- Cualquier modificación al sistema de roles o permisos
- Integración de nuevas librerías nativas (cámara, documentos, biometría)

### Modo de Trabajo
- Respuestas cortas y directas. Sin resúmenes al final.
- Código TypeScript estricto, sin `any`.
- Mensajes de error y UI siempre en **español**.
- Commits descriptivos en inglés.

---

## Regla de Oro — Perfil Verificado

> **Ningún INQUILINO puede contactar a un PROPIETARIO ni crear una solicitud sin tener `verificado_kyc: true` en su perfil.**

**Implementación obligatoria:**
```typescript
// Antes de navegar al formulario de solicitud o al chat
if (!usuario?.verificado_kyc) {
  router.push("/(tabs)/(inquilino)/verificar-identidad");
  return;
}
```

Este guard debe estar presente en:
- `VerViviendaScreen` → botón "Solicitar"
- `CrearSolicitudScreen` → montaje del componente
- Cualquier acción de contacto directo con propietario

---

## Memoria Persistente (Engram / Claude Memory)

### Cómo consultar memoria KYC
Antes de implementar cualquier flujo de cámara o procesamiento de imágenes KYC, consulta:
```
~/.claude/projects/-Users-anderzubizarreta-SAFERENT-SafeRentMobile/memory/kyc_camera_patterns.md
```

### Cómo registrar nuevos aprendizajes
Cuando resuelvas un error repetitivo o descubras un patrón crítico, guárdalo en memoria:
```
Tipo: feedback
Archivo: kyc_camera_patterns.md  (imágenes/cámara)
         rental_flow_patterns.md (flujo de alquiler)
         navigation_patterns.md  (navegación)
```

> **Nota sobre MCP Engram**: Si el servidor MCP de Engram está disponible en la sesión,
> úsalo como fuente primaria de memoria. Si no está disponible, usa el sistema de memoria
> de archivos en `~/.claude/projects/...memory/`. Ambos deben mantenerse sincronizados.

---

## Stack de Referencia Rápida

```
Runtime:    Expo 54 / React Native 0.81 / React 19
Router:     Expo Router v6 (file-based)
Styling:    NativeWind 4 + TailwindCSS 3 (className en RN)
Backend:    Supabase (Auth + PostgreSQL + Storage)
Tipos:      TypeScript strict, path alias @/*
Iconos:     Lucide React Native
Storage:    AsyncStorage (sesión) + Expo Secure Store (credenciales)
```

---

## Estructura de Roles

```
INQUILINO    → /(tabs)/(inquilino)/    color: green  (#10b981)
PROPIETARIO  → /(tabs)/(propietario)/ color: indigo (#6366f1)
ADMINISTRADOR→ /(tabs)/(admin)/       color: rose   (#f43f5e)
```

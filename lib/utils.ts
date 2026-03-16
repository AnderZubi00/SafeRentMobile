export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function estadoColor(
  estado: string
): { bg: string; text: string; label: string } {
  switch (estado) {
    case "PENDIENTE":
      return { bg: "bg-amber-100", text: "text-amber-700", label: "Pendiente" };
    case "ACEPTADA":
      return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Aceptada" };
    case "RECHAZADA":
      return { bg: "bg-red-100", text: "text-red-700", label: "Rechazada" };
    case "COMPLETADO":
      return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completado" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-700", label: estado };
  }
}

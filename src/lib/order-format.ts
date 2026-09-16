import type { Order, Payment, ShipmentStatus, UserAccount } from "@/lib/types";

export function formatOrderStatus(status: Order["status"]) {
  const labels: Record<Order["status"], string> = {
    pendingReceipt: "Pendiente de comprobante",
    receiptInReview: "Comprobante en revision",
    paid: "Pagado",
    preparing: "Preparando",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
    outOfStock: "Sin stock",
  };
  return labels[status];
}

export function formatPaymentStatus(status?: Payment["status"]) {
  if (!status) return "Sin pago";
  const labels: Record<Payment["status"], string> = {
    pendingReceipt: "Pendiente de comprobante",
    inReview: "En revision",
    approved: "Aprobado",
    rejected: "Rechazado",
    voided: "Anulado",
    pendingGateway: "Pago en pasarela",
  };
  return labels[status];
}

export function formatShipmentStatus(status: ShipmentStatus) {
  const labels: Record<ShipmentStatus, string> = {
    pending: "Envio pendiente",
    coordinated: "Envio coordinado",
    registered: "Registrado en courier",
    inTransit: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
    observed: "Con observacion",
  };
  return labels[status];
}

export function formatUserStatus(status: UserAccount["status"]) {
  const labels: Record<UserAccount["status"], string> = {
    active: "Activo",
    inactive: "Inactivo",
    blocked: "Bloqueado",
  };
  return labels[status];
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

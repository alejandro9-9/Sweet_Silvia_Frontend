import type { ApiRole } from "./types";

export const roles = {
  customer: "Cliente",
  administrator: "Administrador",
  assistant: "Asistente",
} as const satisfies Record<string, ApiRole>;

export const roleLabels: Record<ApiRole, string> = {
  Cliente: "Cliente",
  Administrador: "Administrador",
  Asistente: "Asistente",
};

export function canManageCatalog(role?: ApiRole | null) {
  return role === roles.administrator || role === roles.assistant;
}

export function canUploadProductImages(role?: ApiRole | null) {
  return canManageCatalog(role);
}

export function canUploadPaymentReceipts(role?: ApiRole | null) {
  return role === roles.customer;
}

export function canReviewOperations(role?: ApiRole | null) {
  return role === roles.administrator || role === roles.assistant;
}

export function canAdminister(role?: ApiRole | null) {
  return role === roles.administrator;
}

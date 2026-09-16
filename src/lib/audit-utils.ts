import type { AuditLog } from "@/lib/types";

export function sortAuditLogs(logs: AuditLog[]) {
  return [...logs].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

export function isVisibleAuditLog(log: AuditLog) {
  const action = normalizeAuditCompareKey(log.action);
  const compactAction = action.replace(/\s+/g, "");
  const entityName = normalizeAuditCompareKey(log.entityName);

  return !(
    entityName === "refreshtoken" ||
    entityName === "refreshtokens" ||
    compactAction.includes("usersessionrefreshed") ||
    compactAction.includes("refreshtoken")
  );
}

export function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function formatAuditAction(action: string) {
  if (action.startsWith("POST ")) {
    return "Creacion";
  }

  if (action.startsWith("PUT ") || action.startsWith("PATCH ")) {
    return "Modificacion";
  }

  if (action.startsWith("DELETE ")) {
    return "Eliminacion";
  }

  return action
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatAuditActionForLog(log: AuditLog) {
  if (isProductImageAudit(log)) {
    if (log.action.startsWith("POST ")) {
      return "Imagen creada";
    }

    if (log.action.startsWith("PUT ") || log.action.startsWith("PATCH ")) {
      return "Imagen modificada";
    }

    if (log.action.startsWith("DELETE ")) {
      return "Imagen eliminada";
    }
  }

  if (isProductAudit(log)) {
    if (log.action.startsWith("POST ")) {
      return "Producto creado";
    }

    if (log.action.startsWith("PUT ") || log.action.startsWith("PATCH ")) {
      return "Producto modificado";
    }

    if (log.action.startsWith("DELETE ")) {
      return "Producto eliminado";
    }
  }

  return formatAuditAction(log.action);
}

export function formatAuditEntity(entityName: string) {
  const normalizedEntity = normalizeAuditCompareKey(entityName);

  if (normalizedEntity === "productimages" || normalizedEntity === "productimage") {
    return "Imagen de producto";
  }

  if (normalizedEntity === "products" || normalizedEntity === "product") {
    return "Producto";
  }

  return entityName
    .replace(/Controller$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatAuditIp(ipAddress: string | null) {
  if (!ipAddress) {
    return "Sin IP";
  }

  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return "IP local";
  }

  if (ipAddress.startsWith("::ffff:")) {
    return `IP local/proxy ${ipAddress.replace("::ffff:", "")}`;
  }

  return ipAddress;
}

export function formatAuditUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return "Sin navegador";
  }

  const browser = getAuditBrowser(userAgent);
  const os = getAuditOperatingSystem(userAgent);
  return `${browser}${os ? ` en ${os}` : ""}`;
}

function isProductImageAudit(log: AuditLog) {
  const entityName = normalizeAuditCompareKey(log.entityName);
  return entityName === "productimages" || entityName === "productimage";
}

function isProductAudit(log: AuditLog) {
  const entityName = normalizeAuditCompareKey(log.entityName);
  return entityName === "products" || entityName === "product";
}

function normalizeAuditCompareKey(key: string) {
  return key
    .replace(/^request\./, "")
    .replace(/^command\./, "")
    .replace(/^dto\./, "")
    .toLowerCase();
}

function getAuditBrowser(userAgent: string) {
  if (userAgent.includes("Edg/")) {
    return "Microsoft Edge";
  }

  if (userAgent.includes("OPR/") || userAgent.includes("Opera")) {
    return "Opera";
  }

  if (userAgent.includes("Chrome/") && !userAgent.includes("Chromium")) {
    return "Chrome";
  }

  if (userAgent.includes("Firefox/")) {
    return "Firefox";
  }

  if (userAgent.includes("Safari/")) {
    return "Safari";
  }

  return "Navegador";
}

function getAuditOperatingSystem(userAgent: string) {
  if (userAgent.includes("Windows")) {
    return "Windows";
  }

  if (userAgent.includes("Android")) {
    return "Android";
  }

  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    return "iOS";
  }

  if (userAgent.includes("Mac OS")) {
    return "macOS";
  }

  if (userAgent.includes("Linux")) {
    return "Linux";
  }

  return "";
}

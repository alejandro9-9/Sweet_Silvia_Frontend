import { useMemo, useState } from "react";
import { formatAuditAction, formatAuditActionForLog, formatAuditEntity, formatAuditIp, formatAuditUserAgent, uniqueSorted } from "@/lib/audit-utils";
import { shortId } from "@/lib/format";
import { formatDateTime } from "@/lib/order-format";
import type { AuditLog, Product, UserAccount } from "@/lib/types";

export function AdminAuditWorkspace({
  auditLogs,
  productsById,
  usersById,
}: {
  auditLogs: AuditLog[];
  productsById: Map<string, Product>;
  usersById: Map<string, UserAccount>;
}) {
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const actions = useMemo(() => uniqueSorted(auditLogs.map((log) => log.action)), [auditLogs]);
  const entities = useMemo(() => uniqueSorted(auditLogs.map((log) => log.entityName)), [auditLogs]);
  const filteredLogs = useMemo(
    () =>
      auditLogs.filter((log) => {
        const matchesAction = actionFilter ? log.action === actionFilter : true;
        const matchesEntity = entityFilter ? log.entityName === entityFilter : true;
        return matchesAction && matchesEntity;
      }),
    [actionFilter, auditLogs, entityFilter],
  );

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <PanelHeader
        eyebrow="Auditoria"
        title="Historial de acciones"
        text="Revisa cambios y operaciones realizadas desde cuentas administrativas o de asistencia."
      />

      <div className="grid gap-3 border-y border-zinc-200 bg-stone-50/70 p-5 md:grid-cols-2">
        <label className="block text-sm font-semibold">
          Accion
          <select className="admin-input mt-2" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">Todas las acciones</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {formatAuditAction(action)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Entidad
          <select className="admin-input mt-2" value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
            <option value="">Todas las entidades</option>
            {entities.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1280px] divide-y divide-zinc-100">
          <div className="grid grid-cols-[120px_180px_120px_140px_160px_minmax(300px,1fr)_190px] gap-4 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            <span>Fecha</span>
            <span>Usuario</span>
            <span>Rol</span>
            <span>Accion</span>
            <span>Entidad</span>
            <span>Detalle</span>
            <span>Origen</span>
          </div>
          {filteredLogs.map((log) => (
            <AuditLogRow key={log.id} log={log} productsById={productsById} usersById={usersById} />
          ))}
          {filteredLogs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">No hay acciones registradas con los filtros seleccionados.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AuditLogRow({
  log,
  productsById,
  usersById,
}: {
  log: AuditLog;
  productsById: Map<string, Product>;
  usersById: Map<string, UserAccount>;
}) {
  return (
    <article className="grid grid-cols-[120px_180px_120px_140px_160px_minmax(300px,1fr)_190px] gap-4 px-5 py-4 text-sm hover:bg-stone-50">
      <div className="text-zinc-600">
        <AuditMobileLabel label="Fecha" />
        {formatDateTime(log.occurredAt)}
      </div>
      <div>
        <AuditMobileLabel label="Usuario" />
        <p className="break-words font-semibold">{log.actorUserId ? usersById.get(log.actorUserId)?.email ?? `Usuario #${shortId(log.actorUserId)}` : "Sistema"}</p>
        {log.actorUserId ? <p className="text-xs text-zinc-500">#{shortId(log.actorUserId)}</p> : null}
      </div>
      <div>
        <AuditMobileLabel label="Rol" />
        <StatusBadge label={log.actorRole ?? "Sistema"} />
      </div>
      <div className="font-semibold">
        <AuditMobileLabel label="Accion" />
        {formatAuditActionForLog(log)}
      </div>
      <div>
        <AuditMobileLabel label="Entidad" />
        <p className="break-words">{formatAuditEntity(log.entityName)}</p>
        {log.entityId ? <p className="text-xs text-zinc-500">#{shortId(log.entityId)}</p> : null}
      </div>
      <div>
        <AuditMobileLabel label="Detalle" />
        <AuditDetail log={log} productsById={productsById} />
      </div>
      <div className="text-xs text-zinc-500">
        <AuditMobileLabel label="Origen" />
        <p>{formatAuditIp(log.ipAddress)}</p>
        <p className="mt-1 break-words">{formatAuditUserAgent(log.userAgent)}</p>
      </div>
    </article>
  );
}

function AuditMobileLabel({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>;
}

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-700">{label}</span>;
}

function AuditDetail({ log, productsById }: { log: AuditLog; productsById: Map<string, Product> }) {
  const details = describeAuditLog(log, productsById);

  return (
    <div className="max-w-sm space-y-1 text-zinc-600">
      {details.map((detail) => (
        <p className="leading-5" key={detail}>
          {detail}
        </p>
      ))}
    </div>
  );
}

function describeAuditLog(log: AuditLog, productsById: Map<string, Product>) {
  const oldValues = flattenAuditObject(parseAuditJson(log.oldValuesJson));
  const newValues = flattenAuditObject(parseAuditJson(log.newValuesJson));
  const productImageSummary = describeProductImageAuditLog(log, oldValues, newValues, productsById);

  if (productImageSummary.length > 0) {
    return productImageSummary;
  }

  const productSummary = describeProductAuditLog(log, oldValues, newValues);

  if (productSummary.length > 0) {
    return productSummary;
  }

  const changedFields = compareAuditValues(oldValues, newValues);
  const actionText = formatAuditResult(log.action);

  if (changedFields.length > 0) {
    return [`${actionText}:`, ...changedFields.slice(0, 5).map((field) => `${field.label}: anterior ${field.before} / actual ${field.after}`)];
  }

  const submittedFields = Object.entries(newValues)
    .filter(([key]) => isVisibleAuditKey(key))
    .slice(0, 5)
    .map(([key, value]) => `${formatAuditField(key)}: ${formatAuditValue(value)}`);

  if (submittedFields.length > 0) {
    return log.action.startsWith("PUT ") || log.action.startsWith("PATCH ")
      ? [`${actionText}:`, "Anterior: pendiente de captura en este registro.", ...submittedFields.map((field) => `Actual ${field}`)]
      : [`${actionText}:`, ...submittedFields];
  }

  if (log.observation && !isTechnicalObservation(log.observation)) {
    return [`${actionText}:`, log.observation];
  }

  return [`${actionText} en ${formatAuditEntity(log.entityName)}.`];
}

function describeProductImageAuditLog(
  log: AuditLog,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  productsById: Map<string, Product>,
) {
  if (!isProductImageAudit(log)) {
    return [];
  }

  const actionText = formatAuditActionForLog(log);
  const imageId = log.entityId ?? getAuditValue(newValues, "id") ?? getAuditValue(oldValues, "id");
  const productId = getAuditValue(newValues, "productId") ?? getAuditValue(oldValues, "productId");
  const product = typeof productId === "string" ? productsById.get(productId) : null;
  const productText = product ? `${product.name} (#${shortId(product.id)})` : productId ? `#${shortId(String(productId))}` : "no disponible";
  const lines = [`${actionText}:`, `Producto relacionado: ${productText}`];

  if (imageId) {
    lines.push(`Imagen: #${shortId(String(imageId))}`);
  }

  if (log.action.startsWith("PUT ") || log.action.startsWith("PATCH ")) {
    const changedFields = compareAuditValues(oldValues, newValues)
      .filter((field) => ["Variante", "Texto alternativo", "Orden", "Imagen principal"].includes(field.label))
      .slice(0, 4);
    lines.push(...changedFields.map((field) => `${field.label}: anterior ${field.before} / actual ${field.after}`));
  }

  return lines;
}

function isProductImageAudit(log: AuditLog) {
  const entityName = normalizeAuditCompareKey(log.entityName);
  return entityName === "productimages" || entityName === "productimage";
}

function describeProductAuditLog(log: AuditLog, oldValues: Record<string, unknown>, newValues: Record<string, unknown>) {
  if (!isProductAudit(log)) {
    return [];
  }

  const actionText = formatAuditResult(log.action);
  const entityId = log.entityId ?? getAuditValue(newValues, "id") ?? getAuditValue(oldValues, "id");
  const oldName = getAuditValue(oldValues, "name");
  const newName = getAuditValue(newValues, "name");
  const lines = [`${actionText}:`];

  if (entityId) {
    lines.push(`Id: ${formatAuditValue(entityId)}`);
  }

  if (log.action.startsWith("PUT ") || log.action.startsWith("PATCH ")) {
    lines.push(`Nombre anterior: ${oldName ? formatAuditValue(oldName) : "no disponible"}`);
    lines.push(`Nombre actual: ${newName ? formatAuditValue(newName) : "no disponible"}`);
    return lines;
  }

  lines.push(`Nombre: ${formatAuditValue(newName ?? oldName)}`);
  return lines;
}

function isProductAudit(log: AuditLog) {
  return normalizeAuditCompareKey(log.entityName) === "products" || normalizeAuditCompareKey(log.entityName) === "product";
}

function getAuditValue(values: Record<string, unknown>, key: string) {
  const normalizedKey = normalizeAuditCompareKey(key);
  const match = Object.entries(values).find(([entryKey]) => normalizeAuditCompareKey(entryKey) === normalizedKey);
  return match?.[1];
}

function parseAuditJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function flattenAuditObject(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: normalizeAuditValue(value) } : {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((fields, [key, entryValue]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (entryValue && typeof entryValue === "object" && !Array.isArray(entryValue)) {
      return { ...fields, ...flattenAuditObject(entryValue, nextKey) };
    }

    fields[nextKey] = normalizeAuditValue(entryValue);
    return fields;
  }, {});
}

function compareAuditValues(oldValues: Record<string, unknown>, newValues: Record<string, unknown>) {
  const oldValuesByKey = new Map(
    Object.entries(oldValues)
      .filter(([key]) => isVisibleAuditKey(key))
      .map(([key, value]) => [normalizeAuditCompareKey(key), value]),
  );

  return Object.entries(newValues)
    .filter(([key, value]) => {
      const oldValue = oldValuesByKey.get(normalizeAuditCompareKey(key));
      return oldValuesByKey.has(normalizeAuditCompareKey(key)) && isVisibleAuditKey(key) && formatAuditValue(oldValue) !== formatAuditValue(value);
    })
    .map(([key, value]) => ({
      label: formatAuditField(key),
      before: formatAuditValue(oldValuesByKey.get(normalizeAuditCompareKey(key))),
      after: formatAuditValue(value),
    }));
}

function normalizeAuditCompareKey(key: string) {
  return key
    .replace(/^request\./, "")
    .replace(/^command\./, "")
    .replace(/^dto\./, "")
    .toLowerCase();
}

function formatAuditField(key: string) {
  const fieldKey = key
    .replace(/^request\./, "")
    .replace(/^command\./, "")
    .replace(/^dto\./, "");
  const normalizedKey = fieldKey.replace(/Id$/, "");
  const labels: Record<string, string> = {
    actorUser: "Usuario responsable",
    altText: "Texto alternativo",
    basePrice: "Precio base",
    category: "Categoria",
    collection: "Coleccion",
    color: "Color",
    description: "Descripcion",
    email: "Correo",
    entity: "Entidad",
    isActive: "Estado activo",
    isMain: "Imagen principal",
    name: "Nombre",
    order: "Orden",
    payment: "Pago",
    physicalStock: "Stock",
    price: "Precio",
    product: "Producto",
    productVariant: "Variante",
    quantity: "Cantidad",
    role: "Rol",
    size: "Talla",
    sku: "SKU",
    status: "Estado",
  };

  return labels[normalizedKey] ?? normalizedKey
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "vacio";
  }

  if (typeof value === "boolean") {
    return value ? "si" : "no";
  }

  if (Array.isArray(value)) {
    return `${value.length} elemento(s)`;
  }

  if (typeof value === "object") {
    return "datos enviados";
  }

  const text = String(value);
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

function normalizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry): unknown => normalizeAuditValue(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const knownFile = value as { FileName?: unknown; fileName?: unknown; Length?: unknown; length?: unknown; ContentType?: unknown; contentType?: unknown };
  const fileName = knownFile.FileName ?? knownFile.fileName;
  const fileSize = knownFile.Length ?? knownFile.length;
  const fileType = knownFile.ContentType ?? knownFile.contentType;

  if (fileName || fileSize || fileType) {
    return [fileName, fileType, fileSize ? `${fileSize} bytes` : ""].filter(Boolean).join(" - ");
  }

  return value;
}

function isHiddenAuditKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey.includes("password") ||
    normalizedKey.includes("contrasena") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("apikey") ||
    normalizedKey.includes("authorization")
  );
}

function isVisibleAuditKey(key: string) {
  const normalizedKey = normalizeAuditCompareKey(key);
  return !isHiddenAuditKey(key) && normalizedKey !== "id" && normalizedKey !== "createdat" && normalizedKey !== "updatedat";
}

function formatAuditResult(action: string) {
  if (action.startsWith("POST ")) {
    return "Fue creado";
  }

  if (action.startsWith("DELETE ")) {
    return "Fue eliminado";
  }

  return "Fue modificado";
}

function isTechnicalObservation(observation: string) {
  return observation.includes("_Api.Controllers") || observation.includes(".Controllers.") || observation.includes("(") || observation.includes(")");
}

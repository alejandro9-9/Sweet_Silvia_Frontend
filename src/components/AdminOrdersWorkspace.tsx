import { type FormEvent, useEffect, useState } from "react";
import { formatMoney, shortId } from "@/lib/format";
import { formatDate, formatOrderStatus, formatShipmentStatus } from "@/lib/order-format";
import type { Courier, Order, OrderItem, OrderStatusHistory, Shipment, ShipmentStatus, UserAccount } from "@/lib/types";

const orderStatuses: Order["status"][] = ["pendingReceipt", "receiptInReview", "paid", "preparing", "shipped", "delivered", "cancelled", "outOfStock"];
const shipmentStatuses: ShipmentStatus[] = ["pending", "coordinated", "registered", "inTransit", "delivered", "cancelled", "observed"];
const orderTransitions: Record<Order["status"], Order["status"][]> = {
  pendingReceipt: ["receiptInReview", "paid", "cancelled", "outOfStock"],
  receiptInReview: ["pendingReceipt", "paid", "cancelled", "outOfStock"],
  paid: ["preparing"], preparing: ["shipped"], shipped: ["delivered"], delivered: [], cancelled: [], outOfStock: [],
};
const shipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ["coordinated", "registered", "cancelled", "observed"],
  coordinated: ["registered", "cancelled", "observed"],
  registered: ["inTransit", "cancelled", "observed"],
  inTransit: ["delivered", "observed"], delivered: [], cancelled: [], observed: ["coordinated", "registered", "cancelled"],
};

export function OrdersWorkspace({
  couriers,
  orders,
  orderItems,
  selectedOrder,
  statusHistory,
  shipments,
  usersById,
  onSelectOrder,
  onChangeStatus,
  onChangeShipmentStatus,
  onRegisterTracking,
  onCreateShipmentEvent,
}: {
  couriers: Courier[];
  orders: Order[];
  orderItems: OrderItem[];
  selectedOrder: Order | null;
  statusHistory: OrderStatusHistory[];
  shipments: Shipment[];
  usersById: Map<string, UserAccount>;
  onSelectOrder: (orderId: string) => void;
  onChangeStatus: (status: Order["status"], observation: string) => Promise<void>;
  onChangeShipmentStatus: (shipmentId: string, status: ShipmentStatus, observation: string) => Promise<void>;
  onRegisterTracking: (courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string) => Promise<void>;
  onCreateShipmentEvent: (shipmentId: string, status: ShipmentStatus, description: string, location: string, eventDate: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <PanelHeader eyebrow="Pedidos" title="Listado de ordenes" text="Solo se muestran pedidos que ya entraron a revision, pago o preparacion. El carrito no aparece aqui." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y border-zinc-200 bg-stone-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Orden</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  aria-label={"Seleccionar orden " + shortId(order.id)}
                  className={selectedOrder?.id === order.id ? "cursor-pointer border-b border-zinc-100 bg-stone-100" : "cursor-pointer border-b border-zinc-100 hover:bg-stone-50"}
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectOrder(order.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-5 py-4">
                    <span className="font-semibold text-rose-800">#{shortId(order.id)}</span>
                  </td>
                  <td className="px-5 py-4">{usersById.get(order.userId)?.email ?? shortId(order.userId)}</td>
                  <td className="px-5 py-4"><StatusBadge label={formatOrderStatus(order.status)} /></td>
                  <td className="px-5 py-4 font-semibold">{formatMoney(order.total, order.currency)}</td>
                  <td className="px-5 py-4 text-zinc-500">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-zinc-500" colSpan={5}>
                    Aun no hay ordenes operativas. Los carritos y pendientes de comprobante no se muestran en esta bandeja.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <OrderDetail couriers={couriers} order={selectedOrder} items={orderItems} statusHistory={statusHistory} shipments={shipments} onChangeShipmentStatus={onChangeShipmentStatus} onChangeStatus={onChangeStatus} onRegisterTracking={onRegisterTracking} onCreateShipmentEvent={onCreateShipmentEvent} />
    </div>
  );
}

function OrderDetail({
  couriers,
  order,
  items,
  statusHistory,
  shipments,
  onChangeStatus,
  onChangeShipmentStatus,
  onRegisterTracking,
  onCreateShipmentEvent,
}: {
  couriers: Courier[];
  order: Order | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  shipments: Shipment[];
  onChangeShipmentStatus: (shipmentId: string, status: ShipmentStatus, observation: string) => Promise<void>;
  onChangeStatus: (status: Order["status"], observation: string) => Promise<void>;
  onRegisterTracking: (courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string) => Promise<void>;
  onCreateShipmentEvent: (shipmentId: string, status: ShipmentStatus, description: string, location: string, eventDate: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<Order["status"]>("paid");
  const [shipmentStatus, setShipmentStatus] = useState<ShipmentStatus>("pending");
  const [observation, setObservation] = useState("");
  const [shipmentObservation, setShipmentObservation] = useState("");
  const [courierId, setCourierId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [externalShipmentCode, setExternalShipmentCode] = useState("");
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTrackingSubmitting, setIsTrackingSubmitting] = useState(false);
  const [isShipmentStatusSubmitting, setIsShipmentStatusSubmitting] = useState(false);
  const [isEventSubmitting, setIsEventSubmitting] = useState(false);
  const [eventStatus, setEventStatus] = useState<ShipmentStatus>("inTransit");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDate, setEventDate] = useState(() => toDateTimeLocal(new Date()));

  useEffect(() => {
    if (order) {
      const timeoutId = window.setTimeout(() => setStatus(order.status), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [order]);

  useEffect(() => {
    const shipment = shipments[0];
    const timeoutId = window.setTimeout(() => {
      setCourierId(shipment?.courierId ?? couriers[0]?.id ?? "");
      setTrackingCode(shipment?.trackingCode ?? "");
      setExternalShipmentCode(shipment?.externalShipmentCode ?? "");
      setEstimatedDeliveryAt(shipment?.estimatedDeliveryAt ? shipment.estimatedDeliveryAt.slice(0, 10) : "");
      setShipmentStatus(shipment?.status ?? "pending");
      setShipmentObservation("");
      setEventStatus(shipment?.status ?? "inTransit");
      setEventDescription("");
      setEventLocation("");
      setEventDate(toDateTimeLocal(new Date()));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [couriers, shipments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onChangeStatus(status, observation);
      setObservation("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTrackingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courierId || !trackingCode.trim()) {
      return;
    }

    setIsTrackingSubmitting(true);
    try {
      await onRegisterTracking(courierId, trackingCode.trim(), externalShipmentCode.trim(), estimatedDeliveryAt);
    } finally {
      setIsTrackingSubmitting(false);
    }
  }

  async function handleShipmentStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shipment = shipments[0];
    if (!shipment) {
      return;
    }

    setIsShipmentStatusSubmitting(true);
    try {
      await onChangeShipmentStatus(shipment.id, shipmentStatus, shipmentObservation);
      setShipmentObservation("");
    } finally {
      setIsShipmentStatusSubmitting(false);
    }
  }

  async function handleEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shipment = shipments[0];
    if (!shipment || !eventDescription.trim()) {
      return;
    }

    setIsEventSubmitting(true);
    try {
      await onCreateShipmentEvent(shipment.id, eventStatus, eventDescription, eventLocation, eventDate);
      setEventDescription("");
      setEventLocation("");
    } finally {
      setIsEventSubmitting(false);
    }
  }

  const availableOrderStatuses = order ? [order.status, ...orderTransitions[order.status]] : orderStatuses;
  const currentShipment = shipments[0];
  const availableShipmentStatuses = currentShipment ? [currentShipment.status, ...shipmentTransitions[currentShipment.status]] : shipmentStatuses;

  return (
    <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
      <PanelHeader eyebrow="Detalle" title={order ? `Orden #${shortId(order.id)}` : "Sin seleccion"} text="Productos, montos y avance del pedido." />
      {order ? (
        <>
          <div className="space-y-3 border-y border-zinc-200 py-4 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
            <SummaryRow label="Descuento" value={formatMoney(order.discountTotal, order.currency)} />
            <SummaryRow label="Envio" value={formatMoney(order.shippingCost, order.currency)} />
            <SummaryRow label="Total" value={formatMoney(order.total, order.currency)} strong />
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm" key={item.id}>
                <p className="font-semibold uppercase tracking-[0.05em]">{item.productName}</p>
                <p className="mt-1 text-zinc-500">{item.size} - {item.color} - {item.sku}</p>
                <p className="mt-2 font-semibold">{item.quantity} x {formatMoney(item.unitPrice, item.currency)}</p>
              </div>
            ))}
          </div>

          {statusHistory.length > 0 ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Historial del pedido</h3>
              <div className="mt-3 space-y-3 border-l-2 border-rose-100 pl-4">
                {statusHistory.map((entry) => (
                  <div className="relative text-sm" key={entry.id}>
                    <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-rose-600 ring-4 ring-white" />
                    <p className="font-semibold">{entry.previousStatus ? `${formatOrderStatus(entry.previousStatus)} -> ` : ""}{formatOrderStatus(entry.newStatus)}</p>
                    <p className="mt-1 text-zinc-500">{formatDate(entry.changedAt)}{entry.observation ? ` - ${entry.observation}` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              Estado del pedido
              <select className="admin-input mt-2" value={status} onChange={(event) => setStatus(event.target.value as Order["status"])}>
                {availableOrderStatuses.map((entry) => (
                  <option key={entry} value={entry}>{formatOrderStatus(entry)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Observacion
              <textarea className="admin-input mt-2 min-h-20" value={observation} onChange={(event) => setObservation(event.target.value)} />
            </label>
            <button className="admin-primary-button w-full" disabled={isSubmitting || status === order.status}>Actualizar orden</button>
          </form>

          <form className="mt-5 space-y-3 rounded-lg border border-rose-100 bg-rose-50/40 p-4" onSubmit={handleTrackingSubmit}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">Seguimiento</p>
              <h3 className="mt-1 text-lg font-semibold">Numero de seguimiento</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Registra el codigo entregado por la agencia para que el cliente lo vea en su perfil.
              </p>
            </div>
            <label className="block text-sm font-semibold">
              Courier
              <select className="admin-input mt-2" value={courierId} onChange={(event) => setCourierId(event.target.value)} required>
                <option value="">Seleccionar courier</option>
                {couriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>{courier.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Numero de seguimiento
              <input className="admin-input mt-2" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} required />
            </label>
            <label className="block text-sm font-semibold">
              Codigo externo
              <input className="admin-input mt-2" value={externalShipmentCode} onChange={(event) => setExternalShipmentCode(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Entrega estimada
              <input className="admin-input mt-2" type="date" value={estimatedDeliveryAt} onChange={(event) => setEstimatedDeliveryAt(event.target.value)} />
            </label>
            <button className="admin-primary-button w-full" disabled={isTrackingSubmitting || couriers.length === 0}>
              {isTrackingSubmitting ? "Guardando..." : shipments.length > 0 ? "Actualizar seguimiento" : "Crear envio y guardar"}
            </button>
          </form>

          {shipments.length > 0 ? (
            <>
              <form className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4" onSubmit={handleShipmentStatusSubmit}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Avance del envio</p>
                <h3 className="mt-1 text-lg font-semibold">Actualizar estado</h3>
              </div>
              <label className="block text-sm font-semibold">
                Estado del envio
                <select className="admin-input mt-2" value={shipmentStatus} onChange={(event) => setShipmentStatus(event.target.value as ShipmentStatus)}>
                  {availableShipmentStatuses.map((entry) => (
                    <option key={entry} value={entry}>{formatShipmentStatus(entry)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Observacion para seguimiento
                <textarea className="admin-input mt-2 min-h-20" value={shipmentObservation} onChange={(event) => setShipmentObservation(event.target.value)} placeholder="Ej. Pedido entregado a Olva Courier." />
              </label>
              <button className="admin-primary-button w-full" disabled={isShipmentStatusSubmitting || shipmentStatus === shipments[0]?.status}>
                {isShipmentStatusSubmitting ? "Actualizando..." : "Actualizar envio"}
              </button>
              </form>
              <form className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-stone-50 p-4" onSubmit={handleEventSubmit}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Bitacora del courier</p>
                <h3 className="mt-1 text-lg font-semibold">Registrar evento</h3>
              </div>
              <label className="block text-sm font-semibold">
                Estado
                <select className="admin-input mt-2" value={eventStatus} onChange={(event) => setEventStatus(event.target.value as ShipmentStatus)}>
                  {shipmentStatuses.map((entry) => <option key={entry} value={entry}>{formatShipmentStatus(entry)}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Descripcion
                <input className="admin-input mt-2" required value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Ej. El paquete llego a la agencia." />
              </label>
              <label className="block text-sm font-semibold">
                Ubicacion
                <input className="admin-input mt-2" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Ej. Lima" />
              </label>
              <label className="block text-sm font-semibold">
                Fecha del evento
                <input className="admin-input mt-2" required type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              </label>
              <button className="admin-secondary-button w-full" disabled={isEventSubmitting}>{isEventSubmitting ? "Registrando..." : "Registrar evento"}</button>
              </form>
            </>
          ) : null}
        </>
      ) : <p className="text-sm text-zinc-500">No hay ordenes registradas.</p>}
    </aside>
  );
}

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-zinc-600"}><span>{label}</span><span>{value}</span></div>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-700">{label}</span>;
}

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

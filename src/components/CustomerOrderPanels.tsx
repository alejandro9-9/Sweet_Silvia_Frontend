import { useMemo, useState } from "react";
import { PaymentReceiptUploadForm } from "@/components/PaymentReceiptUploadForm";
import { PrivateFileLink } from "@/components/PrivateFileLink";
import { apiRequest } from "@/lib/api";
import { formatMoney, shortId } from "@/lib/format";
import { formatDate, formatOrderStatus, formatPaymentStatus, formatShipmentStatus } from "@/lib/order-format";
import type { OlvaTrackingResponse, Order, OrderItem, Payment, PaymentReceipt, Shipment, ShipmentEvent } from "@/lib/types";

type OrdersPanelProps = {
  orders: Order[];
  itemsByOrder: Record<string, OrderItem[]>;
  paymentsByOrder: Record<string, Payment[]>;
};

export function OrdersPanel({ orders, itemsByOrder, paymentsByOrder }: OrdersPanelProps) {
  return (
    <section className="grid gap-4">
      {orders.length === 0 ? <EmptyState title="Aun no tienes pedidos" text="Cuando completes una compra, la veras aqui." /> : null}
      {orders.map((order) => {
        const payment = paymentsByOrder[order.id]?.[0];
        return (
          <article className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm" key={order.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Pedido #{shortId(order.id)}</p>
                <h2 className="mt-2 text-xl font-semibold">{formatOrderStatus(order.status)}</h2>
                <p className="mt-1 text-sm text-zinc-500">{formatDate(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-500">Total</p>
                <p className="text-lg font-semibold">{formatMoney(order.total, order.currency)}</p>
              </div>
            </div>
            {payment?.status === "rejected" ? <RejectedPaymentNotice observation={payment.observation} /> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px]">
              <div className="space-y-2">
                {(itemsByOrder[order.id] ?? []).map((item) => (
                  <div className="rounded-xl bg-rose-50/50 px-4 py-3 text-sm" key={item.id}>
                    <p className="font-semibold uppercase tracking-[0.06em]">{item.productName}</p>
                    <p className="mt-1 text-zinc-600">{item.quantity} und. - talla {item.size} - {item.color}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 text-sm">
                <SummaryRow label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
                <SummaryRow label="Envio" value={formatMoney(order.shippingCost, order.currency)} />
                <SummaryRow label="Pago" value={formatPaymentStatus(payment?.status)} />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

type TrackingPanelProps = {
  orders: Order[];
  shipmentsByOrder: Record<string, Shipment[]>;
  eventsByShipment: Record<string, ShipmentEvent[]>;
  token: string | null;
};

export function TrackingPanel({ orders, shipmentsByOrder, eventsByShipment, token }: TrackingPanelProps) {
  const trackedOrders = orders.filter((order) => (shipmentsByOrder[order.id] ?? []).length > 0);
  const [liveTrackingByShipment, setLiveTrackingByShipment] = useState<Record<string, OlvaTrackingResponse>>({});
  const [trackingShipmentId, setTrackingShipmentId] = useState<string | null>(null);
  const [trackingMessage, setTrackingMessage] = useState("");

  async function trackWithOlva(orderId: string, shipment: Shipment) {
    setTrackingShipmentId(shipment.id);
    setTrackingMessage("");
    try {
      const tracking = await apiRequest<OlvaTrackingResponse>(`/api/shipping/olva/customer/orders/${orderId}/track`, { method: "POST", token });
      setLiveTrackingByShipment((current) => ({ ...current, [shipment.id]: tracking }));
    } catch (error) {
      setTrackingMessage(error instanceof Error ? error.message : "No se pudo consultar el seguimiento de Olva.");
    } finally {
      setTrackingShipmentId(null);
    }
  }

  return (
    <section className="grid gap-4">
      {trackedOrders.length === 0 ? <EmptyState title="Sin envios registrados" text="Cuando tu pedido tenga despacho, aparecera su avance aqui." /> : null}
      {trackedOrders.flatMap((order) => (shipmentsByOrder[order.id] ?? []).map((shipment) => (
        <article className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm" key={shipment.id}>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Pedido #{shortId(order.id)}</p>
              <h2 className="mt-2 text-xl font-semibold">{formatShipmentStatus(shipment.status)}</h2>
              <p className="mt-1 text-sm text-zinc-500">{shipment.trackingCode ? `Tracking ${shipment.trackingCode}` : "Tracking por confirmar"}</p>
            </div>
            <p className="h-fit rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">{formatMoney(shipment.shippingCost, shipment.currency)}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="admin-secondary-button" disabled={trackingShipmentId === shipment.id || !shipment.trackingCode} type="button" onClick={() => void trackWithOlva(order.id, shipment)}>
              {trackingShipmentId === shipment.id ? "Consultando Olva..." : "Actualizar con Olva"}
            </button>
            {!shipment.trackingCode ? <p className="text-xs text-zinc-500">El seguimiento estara disponible cuando el administrador registre el codigo Olva.</p> : null}
          </div>
          {trackingMessage ? <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-900">{trackingMessage}</p> : null}
          {liveTrackingByShipment[shipment.id] ? <OlvaTrackingSummary tracking={liveTrackingByShipment[shipment.id]} /> : null}
          <div className="mt-5 space-y-3 border-l-2 border-rose-100 pl-4">
            {(eventsByShipment[shipment.id] ?? []).length === 0 ? <p className="text-sm text-zinc-500">Aun no hay eventos de seguimiento.</p> : null}
            {(eventsByShipment[shipment.id] ?? []).map((event) => (
              <div className="relative text-sm" key={event.id}>
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-rose-600 ring-4 ring-white" />
                <p className="font-semibold">{event.description}</p>
                <p className="mt-1 text-zinc-500">{event.location ?? "Sweet Silvia"} - {formatDate(event.eventDate)}</p>
              </div>
            ))}
          </div>
        </article>
      )))}
    </section>
  );
}

function OlvaTrackingSummary({ tracking }: { tracking: OlvaTrackingResponse }) {
  return (
    <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Respuesta de Olva</p>
          <p className="mt-1 font-semibold">{tracking.statusDetail ?? tracking.status ?? "Estado actualizado"}</p>
        </div>
        {tracking.estimatedDelivery ? <p className="text-teal-900">Entrega estimada: {tracking.estimatedDelivery}</p> : null}
      </div>
      {tracking.events.length > 0 ? (
        <div className="mt-3 space-y-2">
          {tracking.events.map((event, index) => (
            <div className="rounded-xl bg-white/70 px-3 py-2" key={`${event.date ?? "event"}-${index}`}>
              <p className="font-semibold">{event.detail ?? event.status ?? "Actualizacion"}</p>
              <p className="mt-1 text-xs text-zinc-500">{event.location ?? "Olva Courier"}{event.date ? ` - ${event.date}` : ""}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 text-zinc-600">Olva no devolvio eventos detallados para este envio.</p>}
    </div>
  );
}

type ReceiptsPanelProps = {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
  receiptsByPayment: Record<string, PaymentReceipt[]>;
  token: string | null;
  onReceiptUploaded: () => void;
};

type ReceiptFilter = "pendingReceipt" | "inReview" | "approved" | "rejected";

const receiptFilters: { id: ReceiptFilter; label: string }[] = [
  { id: "pendingReceipt", label: "Pendientes" },
  { id: "inReview", label: "En revision" },
  { id: "approved", label: "Aprobados" },
  { id: "rejected", label: "Rechazados" },
];

export function ReceiptsPanel({ orders, paymentsByOrder, receiptsByPayment, token, onReceiptUploaded }: ReceiptsPanelProps) {
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const payments = orders.flatMap((order) => paymentsByOrder[order.id] ?? []);
  const [activeFilter, setActiveFilter] = useState<ReceiptFilter>("pendingReceipt");
  const editablePayments = payments.filter((payment) => isPaymentEditableByCustomer(payment, orderById.get(payment.orderId)));
  const filteredPayments = payments.filter((payment) => payment.status === activeFilter);
  const counts = useMemo(
    () => Object.fromEntries(receiptFilters.map((filter) => [filter.id, payments.filter((payment) => payment.status === filter.id).length])) as Record<ReceiptFilter, number>,
    [payments],
  );
  const activeFilterLabel = receiptFilters.find((filter) => filter.id === activeFilter)?.label ?? "Comprobantes";

  return (
    <section className="grid min-w-0 gap-6 lg:grid-cols-[210px_minmax(0,1fr)_280px]">
      <aside className="h-fit rounded-2xl border border-rose-100 bg-white p-3 shadow-sm lg:sticky lg:top-6">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Comprobantes</p>
          <h2 className="mt-1 text-lg font-semibold">Estado</h2>
        </div>
        <nav aria-label="Filtrar comprobantes" className="mt-2 flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
          {receiptFilters.map((filter) => (
            <button
              className={`flex min-w-max items-center justify-between gap-4 rounded-xl px-3 py-3 text-left text-sm font-semibold transition lg:w-full ${activeFilter === filter.id ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-rose-50 hover:text-rose-800"}`}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              type="button"
            >
              <span>{filter.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeFilter === filter.id ? "bg-white/15 text-white" : "bg-stone-100 text-zinc-500"}`}>{counts[filter.id]}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Bandeja de comprobantes</p>
            <h2 className="mt-1 text-2xl font-semibold">{activeFilterLabel}</h2>
          </div>
          <p className="text-sm text-zinc-500">{filteredPayments.length} comprobante{filteredPayments.length === 1 ? "" : "s"}</p>
        </div>
        {payments.length === 0 ? <EmptyState title="Sin pagos registrados" text="Cuando elijas un metodo de pago, el comprobante aparecera en esta seccion." /> : null}
        {payments.length > 0 && filteredPayments.length === 0 ? <EmptyState title={`Sin comprobantes ${activeFilterLabel.toLocaleLowerCase("es-PE")}`} text="Prueba con otro estado para consultar tus comprobantes." /> : null}
        {filteredPayments.map((payment) => (
          <article className="min-w-0 overflow-hidden rounded-2xl border border-rose-100 bg-white p-5 shadow-sm" key={payment.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Orden #{shortId(payment.orderId)}</p>
                <h2 className="mt-2 text-lg font-semibold">{formatPaymentStatus(payment.status)}</h2>
              </div>
              <p className="font-semibold">{formatMoney(payment.amount, payment.currency)}</p>
            </div>
            {payment.status === "rejected" ? <RejectedPaymentNotice observation={payment.observation} /> : null}
            <div className="mt-4 grid gap-3">
              {(receiptsByPayment[payment.id] ?? []).length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">Aun no adjuntaste comprobante.</p> : null}
              {(receiptsByPayment[payment.id] ?? []).map((receipt) => (
                <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white" key={receipt.id}>
                  <PrivateFileLink className="p-4 text-sm hover:bg-rose-50/30" label={`Comprobante ${formatReceiptStatus(receipt.status)}`} path={`/api/payment-receipts/${receipt.id}/file`} token={token} />
                  <p className="border-t border-zinc-100 px-4 py-2 text-xs leading-5 text-zinc-500 break-words">
                    {receipt.operationCode ?? "Sin codigo"} - {receipt.declaredAmount ? formatMoney(receipt.declaredAmount, receipt.currency ?? payment.currency) : "Sin monto declarado"}
                  </p>
                </div>
              ))}
            </div>
            {isPaymentEditableByCustomer(payment, orderById.get(payment.orderId)) ? (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
                <PaymentReceiptUploadForm fixedOrder={orderById.get(payment.orderId)} fixedPayment={payment} onUploaded={onReceiptUploaded} submitLabel={payment.status === "rejected" ? "Enviar nuevo comprobante" : "Agregar comprobante"} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <aside className="h-fit rounded-2xl border border-rose-100 bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Acciones</p>
        <h2 className="mt-2 text-xl font-semibold">Comprobantes editables</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Solo puedes agregar o reemplazar comprobantes cuando el pago esta pendiente o fue rechazado por administracion.</p>
        <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{editablePayments.length} pendiente(s) por atender.</p>
      </aside>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between py-1"><span className="text-zinc-500">{label}</span><span className="font-semibold">{value}</span></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-rose-200 bg-white p-8 text-center"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-zinc-500">{text}</p></div>;
}

function RejectedPaymentNotice({ observation }: { observation: string | null }) {
  return <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">Comprobante rechazado</p><p className="mt-1">{observation || "El administrador rechazo el comprobante. Adjunta uno nuevo para continuar."}</p></div>;
}

function isPaymentEditableByCustomer(payment: Payment, order: Order | undefined) {
  if (!order || order.status === "cancelled" || order.status === "delivered" || order.status === "outOfStock") return false;
  return payment.status === "pendingReceipt" || payment.status === "rejected";
}

function formatReceiptStatus(status: PaymentReceipt["status"]) {
  return { uploaded: "cargado", approved: "aprobado", rejected: "rechazado" }[status];
}

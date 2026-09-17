import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { formatMoney, shortId } from "@/lib/format";
import { formatDate, formatOrderStatus, formatPaymentStatus, formatShipmentStatus } from "@/lib/order-format";
import type { Address, Courier, Department, District, OlvaAgency, Order, OrderItem, OrderStatusHistory, Payment, Province, Shipment, ShipmentStatus, UserAccount } from "@/lib/types";

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
  payments,
  selectedOrder,
  statusHistory,
  shipments,
  usersById,
  token,
  onSelectOrder,
  onChangeStatus,
  onChangeShipmentStatus,
  onRegisterTracking,
  onCreateShipmentEvent,
}: {
  couriers: Courier[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
  selectedOrder: Order | null;
  statusHistory: OrderStatusHistory[];
  shipments: Shipment[];
  usersById: Map<string, UserAccount>;
  token: string | null;
  onSelectOrder: (orderId: string) => void;
  onChangeStatus: (status: Order["status"], observation: string) => Promise<void>;
  onChangeShipmentStatus: (shipmentId: string, status: ShipmentStatus, observation: string) => Promise<void>;
  onRegisterTracking: (courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string, observation: string) => Promise<void>;
  onCreateShipmentEvent: (shipmentId: string, status: ShipmentStatus, description: string, location: string, eventDate: string) => Promise<void>;
}) {
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const previewOrder = orders.find((order) => order.id === previewOrderId) ?? null;
  const deliveryDetails = useOrderDeliveryDetails(previewOrder ?? selectedOrder, token);

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
              {orders.map((order) => {
                const needsAttention = order.status === "receiptInReview" || order.status === "paid" || order.status === "preparing";
                return <tr
                  aria-label={"Seleccionar orden " + shortId(order.id)}
                  className={`${selectedOrder?.id === order.id ? "bg-stone-100" : needsAttention ? "bg-rose-50/20 hover:bg-rose-50/50" : "hover:bg-stone-50"} cursor-pointer border-b border-zinc-100 ${needsAttention ? "border-l-4 border-l-rose-500" : "border-l-0"}`}
                  key={order.id}
                  onClick={() => {
                    onSelectOrder(order.id);
                    setPreviewOrderId(order.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectOrder(order.id);
                      setPreviewOrderId(order.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className={`px-5 py-4 ${needsAttention ? "font-bold text-rose-900" : ""}`}>
                    <span className="font-semibold text-rose-800">#{shortId(order.id)}</span>
                  </td>
                  <td className={`px-5 py-4 ${needsAttention ? "font-bold text-rose-900" : ""}`}>{usersById.get(order.userId)?.email ?? shortId(order.userId)}</td>
                  <td className="px-5 py-4"><StatusBadge attention={needsAttention} label={formatOrderStatus(order.status)} /></td>
                  <td className={`px-5 py-4 font-semibold ${needsAttention ? "font-bold text-rose-900" : ""}`}>{formatMoney(order.total, order.currency)}</td>
                  <td className={`px-5 py-4 ${needsAttention ? "font-semibold text-rose-800" : "text-zinc-500"}`}>{formatDate(order.createdAt)}</td>
                </tr>;
              })}
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

      <OrderDetail couriers={couriers} order={selectedOrder} items={orderItems} payments={payments} statusHistory={statusHistory} shipments={shipments} usersById={usersById} deliveryDetails={deliveryDetails} onChangeShipmentStatus={onChangeShipmentStatus} onChangeStatus={onChangeStatus} onRegisterTracking={onRegisterTracking} onCreateShipmentEvent={onCreateShipmentEvent} />
      {previewOrder ? <OrderPreviewModal couriers={couriers} order={previewOrder} items={selectedOrder?.id === previewOrder.id ? orderItems : []} payments={payments} statusHistory={selectedOrder?.id === previewOrder.id ? statusHistory : []} shipments={selectedOrder?.id === previewOrder.id ? shipments : []} usersById={usersById} deliveryDetails={deliveryDetails} onClose={() => setPreviewOrderId(null)} /> : null}
    </div>
  );
}

function useOrderDeliveryDetails(order: Order | null, token: string | null) {
  const [address, setAddress] = useState<Address | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [province, setProvince] = useState<Province | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [shippingAgency, setShippingAgency] = useState<OlvaAgency | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadDeliveryDetails() {
      setAddress(null);
      setDepartment(null);
      setProvince(null);
      setDistrict(null);
      setShippingAgency(null);

      if (!order) {
        return;
      }

      try {
        const [addresses, agencies] = await Promise.all([
          order.addressId ? apiRequest<Address[]>(`/api/addresses/user/${order.userId}`, { token }) : Promise.resolve([] as Address[]),
          order.shippingAgencyId ? apiRequest<OlvaAgency[]>("/api/shipping/olva/agencies?pageSize=200", { token }) : Promise.resolve([] as OlvaAgency[]),
        ]);
        const nextAddress = addresses.find((entry) => entry.id === order.addressId) ?? null;
        const nextAgency = agencies.find((entry) => entry.id === order.shippingAgencyId) ?? null;
        let nextDepartment: Department | null = null;
        let nextProvince: Province | null = null;
        let nextDistrict: District | null = null;

        if (nextAddress) {
          [nextDepartment, nextProvince, nextDistrict] = await Promise.all([
            apiRequest<Department>(`/api/departments/${nextAddress.departmentId}`, { token }),
            apiRequest<Province>(`/api/provinces/${nextAddress.provinceId}`, { token }),
            apiRequest<District>(`/api/districts/${nextAddress.districtId}`, { token }),
          ]);
        }

        if (isActive) {
          setAddress(nextAddress);
          setDepartment(nextDepartment);
          setProvince(nextProvince);
          setDistrict(nextDistrict);
          setShippingAgency(nextAgency);
        }
      } catch {
        if (isActive) {
          setAddress(null);
          setDepartment(null);
          setProvince(null);
          setDistrict(null);
          setShippingAgency(null);
        }
      }
    }

    void loadDeliveryDetails();
    return () => {
      isActive = false;
    };
  }, [order, token]);

  return { address, department, province, district, shippingAgency } satisfies OrderDeliveryDetails;
}

type OrderDeliveryDetails = {
  address: Address | null;
  department: Department | null;
  province: Province | null;
  district: District | null;
  shippingAgency: OlvaAgency | null;
};

function OrderPreviewModal({
  couriers,
  order,
  items,
  payments,
  statusHistory,
  shipments,
  usersById,
  deliveryDetails,
  onClose,
}: {
  couriers: Courier[];
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  statusHistory: OrderStatusHistory[];
  shipments: Shipment[];
  usersById: Map<string, UserAccount>;
  deliveryDetails: OrderDeliveryDetails;
  onClose: () => void;
}) {
  const { address, department, province, district, shippingAgency } = deliveryDetails;
  const customer = usersById.get(order.userId);
  const orderPayments = payments.filter((payment) => payment.orderId === order.id);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4" role="presentation" onClick={onClose}>
      <section className="flex max-h-[min(90vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="order-preview-title" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Vista de orden</p>
            <h2 className="mt-1 text-2xl font-semibold" id="order-preview-title">Orden #{shortId(order.id)}</h2>
            <p className="mt-1 text-sm text-zinc-600">Informacion del pedido en modo visualizacion.</p>
          </div>
          <button aria-label="Cerrar vista de orden" className="admin-secondary-button shrink-0" onClick={onClose} type="button">Cerrar</button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-4">
            <StatusBadge attention={order.status === "receiptInReview" || order.status === "paid" || order.status === "preparing"} label={formatOrderStatus(order.status)} />
            <span className="text-sm text-zinc-500">Creada {formatDate(order.createdAt)}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoBlock title="Cliente">
              <p className="font-semibold">{customer ? `${customer.name} ${customer.paternalSurname}` : "Cliente no disponible"}</p>
              <p className="mt-1 break-all text-zinc-600">{customer?.email ?? shortId(order.userId)}</p>
              {customer?.phone ? <p className="mt-1 text-zinc-600">{customer.phone}</p> : null}
            </InfoBlock>
            <InfoBlock title="Pago">
              {orderPayments.length > 0 ? orderPayments.map((payment) => (
                <div className="border-b border-zinc-200 pb-2 text-sm last:border-0 last:pb-0" key={payment.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{formatPaymentStatus(payment.status)}</span>
                    <span className="shrink-0 font-semibold">{formatMoney(payment.amount, payment.currency)}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(payment.createdAt)}{payment.transactionCode ? ` · ${payment.transactionCode}` : ""}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">Sin pago registrado.</p>}
            </InfoBlock>
          </div>

          <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/40 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">Entrega</p>
            <p className="mt-1 font-semibold">
              {address ? `Delivery ${department?.destinationType === "lima" ? "Lima" : "provincial"}` : shippingAgency ? "Recojo en agencia Olva" : "Ubicacion no disponible"}
            </p>
            {address ? (
              <>
                <p className="mt-1">{[department?.name, province?.name, district?.name].filter(Boolean).join(" / ") || "Ubicacion por confirmar"}</p>
                <p className="mt-1 text-zinc-600">{address.line}</p>
                {address.references ? <p className="mt-1 text-zinc-600">Referencia: {address.references}</p> : null}
                <p className="mt-1 text-zinc-600">Recibe: {address.receiverName} · {address.receiverPhone}</p>
              </>
            ) : shippingAgency ? (
              <>
                <p className="mt-1">{shippingAgency.name}{shippingAgency.code ? ` (${shippingAgency.code})` : ""}</p>
                <p className="mt-1 text-zinc-600">{[shippingAgency.department, shippingAgency.province, shippingAgency.district].filter(Boolean).join(" / ") || "Ubicacion por confirmar"}</p>
                {shippingAgency.address ? <p className="mt-1 text-zinc-600">{shippingAgency.address}</p> : null}
                {shippingAgency.phone ? <p className="mt-1 text-zinc-600">{shippingAgency.phone}</p> : null}
              </>
            ) : <p className="mt-1 text-zinc-600">No hay direccion o agencia asociada.</p>}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Prendas</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {items.length > 0 ? items.map((item) => (
                <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm" key={item.id}>
                  <p className="font-semibold uppercase tracking-[0.05em]">{item.productName}</p>
                  <p className="mt-1 text-zinc-500">{item.size} - {item.color} - {item.sku}</p>
                  <p className="mt-2 font-semibold">{item.quantity} x {formatMoney(item.unitPrice, item.currency)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Subtotal: {formatMoney(item.subtotal, item.currency)}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">Cargando prendas o no hay prendas registradas.</p>}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <InfoBlock title="Resumen">
              <div className="space-y-2">
                <SummaryRow label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
                <SummaryRow label="Descuento" value={formatMoney(order.discountTotal, order.currency)} />
                <SummaryRow label="Envio" value={formatMoney(order.shippingCost, order.currency)} />
                <SummaryRow label="Total" value={formatMoney(order.total, order.currency)} strong />
              </div>
            </InfoBlock>
            <InfoBlock title="Envio">
              {shipments.length > 0 ? shipments.map((shipment) => (
                <div className="text-sm" key={shipment.id}>
                  <p className="font-semibold">{couriers.find((courier) => courier.id === shipment.courierId)?.name ?? "Courier no disponible"}</p>
                  <p className="mt-1 text-zinc-600">{formatShipmentStatus(shipment.status)}</p>
                  {shipment.trackingCode ? <p className="mt-1 text-zinc-600">Seguimiento: {shipment.trackingCode}</p> : null}
                  {shipment.externalShipmentCode ? <p className="mt-1 text-zinc-600">Codigo externo: {shipment.externalShipmentCode}</p> : null}
                  {shipment.estimatedDeliveryAt ? <p className="mt-1 text-zinc-600">Entrega estimada: {formatDate(shipment.estimatedDeliveryAt)}</p> : null}
                  {shipment.observation ? <p className="mt-1 text-zinc-600">Observacion: {shipment.observation}</p> : null}
                </div>
              )) : <p className="text-sm text-zinc-500">No hay envio registrado.</p>}
            </InfoBlock>
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
        </div>

        <footer className="flex justify-end border-t border-zinc-200 bg-stone-50 px-5 py-3">
          <button className="admin-primary-button" onClick={onClose} type="button">Cerrar vista</button>
        </footer>
      </section>
    </div>
  );
}

function OrderDetail({
  couriers,
  order,
  items,
  payments,
  statusHistory,
  shipments,
  usersById,
  deliveryDetails,
  onChangeStatus,
  onChangeShipmentStatus,
  onRegisterTracking,
  onCreateShipmentEvent,
}: {
  couriers: Courier[];
  order: Order | null;
  items: OrderItem[];
  payments: Payment[];
  statusHistory: OrderStatusHistory[];
  shipments: Shipment[];
  usersById: Map<string, UserAccount>;
  deliveryDetails: OrderDeliveryDetails;
  onChangeShipmentStatus: (shipmentId: string, status: ShipmentStatus, observation: string) => Promise<void>;
  onChangeStatus: (status: Order["status"], observation: string) => Promise<void>;
  onRegisterTracking: (courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string, observation: string) => Promise<void>;
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
  const selectedCourier = couriers.find((courier) => courier.id === courierId);
  const isOlvaCourier = selectedCourier?.name.toLocaleLowerCase("es-PE").includes("olva") ?? false;
  const customer = order ? usersById.get(order.userId) : null;
  const orderPayments = order ? payments.filter((payment) => payment.orderId === order.id) : [];
  const { address, department, province, district, shippingAgency } = deliveryDetails;

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
    if (!courierId || (isOlvaCourier && !trackingCode.trim())) {
      return;
    }

    setIsTrackingSubmitting(true);
    try {
      await onRegisterTracking(courierId, trackingCode.trim(), externalShipmentCode.trim(), estimatedDeliveryAt, shipmentObservation.trim());
      if (!isOlvaCourier) {
        setShipmentObservation("");
      }
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
            <SummaryRow label="Creado" value={formatDate(order.createdAt)} />
            {order.couponId ? <SummaryRow label="Cupon" value={shortId(order.couponId)} /> : null}
            <SummaryRow label="Total" value={formatMoney(order.total, order.currency)} strong />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoBlock title="Cliente">
              <p className="font-semibold">{customer ? `${customer.name} ${customer.paternalSurname}` : "Cliente no disponible"}</p>
              <p className="mt-1 break-all text-zinc-600">{customer?.email ?? shortId(order.userId)}</p>
              {customer?.phone ? <p className="mt-1 text-zinc-600">{customer.phone}</p> : null}
            </InfoBlock>
            <InfoBlock title="Pago">
              {orderPayments.length > 0 ? orderPayments.map((payment) => (
                <div className="border-b border-zinc-200 pb-2 text-sm last:border-0 last:pb-0" key={payment.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{formatPaymentStatus(payment.status)}</span>
                    <span className="shrink-0 font-semibold">{formatMoney(payment.amount, payment.currency)}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(payment.createdAt)}{payment.transactionCode ? ` · ${payment.transactionCode}` : ""}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">Sin pago registrado.</p>}
            </InfoBlock>
          </div>

          <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/40 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">Entrega</p>
            <p className="mt-1 font-semibold">
              {address ? `Delivery ${department?.destinationType === "lima" ? "Lima" : "provincial"}` : shippingAgency ? "Recojo en agencia Olva" : "Ubicacion no disponible"}
            </p>
            {address ? (
              <>
                <p className="mt-1">{[department?.name, province?.name, district?.name].filter(Boolean).join(" / ") || "Ubicacion por confirmar"}</p>
                <p className="mt-1 text-zinc-600">{address.line}</p>
                {address.references ? <p className="mt-1 text-zinc-600">Referencia: {address.references}</p> : null}
                <p className="mt-1 text-zinc-600">Recibe: {address.receiverName} · {address.receiverPhone}</p>
              </>
            ) : shippingAgency ? (
              <>
                <p className="mt-1">{shippingAgency.name}{shippingAgency.code ? ` (${shippingAgency.code})` : ""}</p>
                <p className="mt-1 text-zinc-600">{[shippingAgency.department, shippingAgency.province, shippingAgency.district].filter(Boolean).join(" / ") || "Ubicacion por confirmar"}</p>
                {shippingAgency.address ? <p className="mt-1 text-zinc-600">{shippingAgency.address}</p> : null}
                {shippingAgency.phone ? <p className="mt-1 text-zinc-600">{shippingAgency.phone}</p> : null}
              </>
            ) : <p className="mt-1 text-zinc-600">No hay direccion o agencia asociada.</p>}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Prendas</h3>
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
                {isOlvaCourier ? "Registra el codigo entregado por Olva para que el cliente lo vea en su perfil." : "Este courier no usa tracking. Guarda una observacion para informar al cliente."}
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
            {isOlvaCourier ? (
              <>
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
              </>
            ) : (
              <label className="block text-sm font-semibold">
                Observacion del envio
                <textarea className="admin-input mt-2 min-h-20" value={shipmentObservation} onChange={(event) => setShipmentObservation(event.target.value)} placeholder="Ej. Entrega coordinada con el cliente." />
              </label>
            )}
            <button className="admin-primary-button w-full" disabled={isTrackingSubmitting || couriers.length === 0}>
              {isTrackingSubmitting ? "Guardando..." : isOlvaCourier ? shipments.length > 0 ? "Actualizar seguimiento" : "Crear envio y guardar" : shipments.length > 0 ? "Guardar observacion" : "Crear envio y guardar"}
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

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</p><div className="mt-2">{children}</div></div>;
}

function StatusBadge({ attention = false, label }: { attention?: boolean; label: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${attention ? "bg-rose-100 text-rose-800" : "bg-stone-100 text-zinc-700"}`}>{label}</span>;
}

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

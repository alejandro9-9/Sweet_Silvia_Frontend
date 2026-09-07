"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, publicAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/roles";
import type { AuditLog, Courier, Order, OrderItem, Payment, PaymentReceipt, PaymentReview, Product, Shipment, ShipmentStatus, UserAccount } from "@/lib/types";

type AdminTab = "users" | "orders" | "payments" | "audit";
type PaymentReviewResult = "approved" | "rejected";

const orderStatuses: Order["status"][] = [
  "pendingReceipt",
  "receiptInReview",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "outOfStock",
];

const shipmentStatuses: ShipmentStatus[] = ["pending", "coordinated", "registered", "inTransit", "delivered", "cancelled", "observed"];

export function AdminOperations() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [reviews, setReviews] = useState<PaymentReview[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shipmentsByOrder, setShipmentsByOrder] = useState<Record<string, Shipment[]>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const operationalOrders = useMemo(() => orders.filter((order) => order.status !== "pendingReceipt"), [orders]);
  const selectedOrder = operationalOrders.find((order) => order.id === selectedOrderId) ?? operationalOrders[0] ?? null;
  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0] ?? null;
  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const ordersById = useMemo(() => new Map(orders.map((entry) => [entry.id, entry])), [orders]);
  const productsById = useMemo(() => new Map(products.map((entry) => [entry.id, entry])), [products]);
  const visibleAuditLogs = useMemo(() => auditLogs.filter(isVisibleAuditLog), [auditLogs]);
  const selectedOrderShipments = selectedOrder ? shipmentsByOrder[selectedOrder.id] ?? [] : [];
  const pendingPayments = payments.filter((payment) => payment.status === "inReview" || payment.status === "pendingReceipt");
  const canManageUsersAndReviews = canAdminister(user?.role);

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      Promise.all([
        canManageUsersAndReviews ? apiRequest<UserAccount[]>("/api/users", { token }) : Promise.resolve<UserAccount[]>([]),
        apiRequest<Order[]>("/api/orders", { token }),
        apiRequest<Payment[]>("/api/payments", { token }),
        canManageUsersAndReviews ? apiRequest<AuditLog[]>("/api/audit-logs", { token }) : Promise.resolve<AuditLog[]>([]),
        apiRequest<Product[]>("/api/products?onlyActive=false", { token }),
        apiRequest<Courier[]>("/api/couriers", { token }).catch(() => []),
      ])
        .then(async ([nextUsers, nextOrders, nextPayments, nextAuditLogs, nextProducts, nextCouriers]) => {
          const shipmentPairs = await Promise.all(
            nextOrders
              .filter((order) => order.status !== "pendingReceipt")
              .map(async (order) => ({
                orderId: order.id,
                shipments: await apiRequest<Shipment[]>(`/api/shipments/order/${order.id}`, { token }).catch(() => []),
              })),
          );
          if (!isActive) {
            return;
          }
          setUsers(nextUsers);
          setOrders(nextOrders);
          setPayments(nextPayments);
          setProducts(nextProducts);
          setCouriers(nextCouriers);
          setShipmentsByOrder(Object.fromEntries(shipmentPairs.map((entry) => [entry.orderId, entry.shipments])));
          setAuditLogs(sortAuditLogs(nextAuditLogs));
          setSelectedOrderId(nextOrders.find((order) => order.status !== "pendingReceipt")?.id ?? "");
          setSelectedPaymentId(nextPayments[0]?.id ?? "");
        })
        .catch((error: Error) => {
          if (isActive) {
            setMessage(error.message);
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [canManageUsersAndReviews, token]);

  useEffect(() => {
    if (!selectedOrderId) {
      const timeoutId = window.setTimeout(() => setOrderItems([]), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      apiRequest<OrderItem[]>(`/api/order-items/order/${selectedOrderId}`, { token })
        .then((nextItems) => {
          if (isActive) {
            setOrderItems(nextItems);
          }
        })
        .catch(() => {
          if (isActive) {
            setOrderItems([]);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [selectedOrderId, token]);

  useEffect(() => {
    if (!selectedPaymentId) {
      const timeoutId = window.setTimeout(() => {
        setReceipts([]);
        setReviews([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      Promise.all([
        apiRequest<PaymentReceipt[]>(`/api/payment-receipts/payment/${selectedPaymentId}`, { token }).catch(() => []),
        apiRequest<PaymentReview[]>(`/api/payment-reviews/payment/${selectedPaymentId}`, { token }).catch(() => []),
      ]).then(([nextReceipts, nextReviews]) => {
        if (!isActive) {
          return;
        }
        setReceipts(nextReceipts);
        setReviews(nextReviews);
      });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [selectedPaymentId, token]);

  async function refreshPayments(successMessage: string) {
    const [nextOrders, nextPayments] = await Promise.all([
      apiRequest<Order[]>("/api/orders", { token }),
      apiRequest<Payment[]>("/api/payments", { token }),
    ]);
    setOrders(nextOrders);
    setPayments(nextPayments);
    setMessage(successMessage);
  }

  async function changeOrderStatus(status: Order["status"], observation: string) {
    if (!selectedOrder) {
      return;
    }

    await apiRequest<void>(`/api/orders/${selectedOrder.id}/status`, {
      method: "PATCH",
      body: { status, observation },
      token,
    });
    const nextOrders = await apiRequest<Order[]>("/api/orders", { token });
    setOrders(nextOrders);
    setMessage("Estado de orden actualizado.");
  }

  async function refreshOrderShipments(orderId: string) {
    const nextShipments = await apiRequest<Shipment[]>(`/api/shipments/order/${orderId}`, { token }).catch(() => []);
    setShipmentsByOrder((current) => ({ ...current, [orderId]: nextShipments }));
    return nextShipments;
  }

  async function registerOrderTracking(courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string) {
    if (!selectedOrder) {
      return;
    }

    let shipment = selectedOrderShipments[0] ?? null;
    if (!shipment) {
      const shipmentResponse = await apiRequest<{ id: string }>("/api/shipments", {
        method: "POST",
        body: {
          orderId: selectedOrder.id,
          courierId,
          shippingCost: selectedOrder.shippingCost,
          currency: selectedOrder.currency,
        },
        token,
      });
      const nextShipments = await refreshOrderShipments(selectedOrder.id);
      shipment = nextShipments.find((entry) => entry.id === shipmentResponse.id) ?? nextShipments[0] ?? null;
    }

    if (!shipment) {
      setMessage("No se pudo preparar el envio para esta orden.");
      return;
    }

    await apiRequest<void>(`/api/shipments/${shipment.id}/register-external`, {
      method: "PATCH",
      body: {
        trackingCode,
        externalShipmentCode: externalShipmentCode || null,
        estimatedDeliveryAt: estimatedDeliveryAt ? new Date(estimatedDeliveryAt).toISOString() : null,
      },
      token,
    });
    await refreshOrderShipments(selectedOrder.id);
    setMessage("Numero de seguimiento registrado.");
  }

  async function changeShipmentStatus(shipmentId: string, status: ShipmentStatus, observation: string) {
    if (!selectedOrder) {
      return;
    }

    await apiRequest<void>(`/api/shipments/${shipmentId}/status`, {
      method: "PATCH",
      body: { status, observation: observation.trim() || null },
      token,
    });
    await refreshOrderShipments(selectedOrder.id);
    setMessage("Estado de envio actualizado.");
  }

  async function reviewPayment(result: PaymentReviewResult, observation: string) {
    if (!selectedPayment) {
      return;
    }

    await apiRequest<void>("/api/payment-reviews", {
      method: "POST",
      body: { paymentId: selectedPayment.id, result, observation },
      token,
    });
    await refreshPayments(result === "approved" ? "Pago aprobado correctamente." : "Pago rechazado.");
  }

  async function blockUser(userId: string) {
    await apiRequest<void>(`/api/users/${userId}/block`, {
      method: "PATCH",
      token,
    });
    const nextUsers = await apiRequest<UserAccount[]>("/api/users", { token });
    setUsers(nextUsers);
    setMessage("Usuario bloqueado correctamente.");
  }

  async function unblockUser(userId: string) {
    await apiRequest<void>(`/api/users/${userId}/unblock`, {
      method: "PATCH",
      token,
    });
    const nextUsers = await apiRequest<UserAccount[]>("/api/users", { token });
    setUsers(nextUsers);
    setMessage("Usuario desbloqueado correctamente.");
  }

  function openPaymentsTab(preferPending = false) {
    setActiveTab("payments");
    if (preferPending) {
      setSelectedPaymentId(pendingPayments[0]?.id ?? payments[0]?.id ?? "");
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-5">
        {canManageUsersAndReviews ? <OperationMetric active={activeTab === "users"} label="Usuarios" value={users.length} onClick={() => setActiveTab("users")} /> : null}
        <OperationMetric active={activeTab === "orders"} label="Ordenes" value={operationalOrders.length} onClick={() => setActiveTab("orders")} />
        <OperationMetric active={activeTab === "payments"} label="Pagos" value={payments.length} onClick={() => openPaymentsTab()} />
        <OperationMetric active={activeTab === "payments" && pendingPayments.length > 0} label="Por revisar" value={pendingPayments.length} tone="rose" onClick={() => openPaymentsTab(true)} />
        {canManageUsersAndReviews ? (
          <OperationMetric active={activeTab === "audit"} label="Auditoria" value={visibleAuditLogs.length} onClick={() => setActiveTab("audit")} />
        ) : null}
      </section>

      {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{message}</div> : null}
      {isLoading ? <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Cargando operacion...</div> : null}

      {activeTab === "orders" ? (
        <OrdersWorkspace
          couriers={couriers}
          orderItems={orderItems}
          orders={operationalOrders}
          selectedOrder={selectedOrder}
          shipments={selectedOrderShipments}
          usersById={usersById}
          onChangeStatus={changeOrderStatus}
          onChangeShipmentStatus={changeShipmentStatus}
          onRegisterTracking={registerOrderTracking}
          onSelectOrder={setSelectedOrderId}
        />
      ) : null}

      {activeTab === "payments" ? (
        <PaymentsWorkspace
          ordersById={ordersById}
          payments={payments}
          receipts={receipts}
          reviews={reviews}
          selectedPayment={selectedPayment}
          usersById={usersById}
          canReviewPayment={canManageUsersAndReviews}
          onReview={reviewPayment}
          onSelectPayment={setSelectedPaymentId}
        />
      ) : null}

      {activeTab === "users" && canManageUsersAndReviews ? <UsersWorkspace currentUserId={user?.id ?? ""} users={users} onBlockUser={blockUser} onUnblockUser={unblockUser} /> : null}
      {activeTab === "audit" && canManageUsersAndReviews ? <AuditWorkspace auditLogs={visibleAuditLogs} productsById={productsById} usersById={usersById} /> : null}
    </div>
  );
}

function OperationMetric({
  active,
  label,
  value,
  tone = "zinc",
  onClick,
}: {
  active: boolean;
  label: string;
  value: number;
  tone?: "zinc" | "rose";
  onClick: () => void;
}) {
  const borderClass = active ? "border-zinc-950 bg-zinc-950 text-white ring-2 ring-zinc-950/10" : tone === "rose" ? "border-rose-200 bg-white" : "border-zinc-200 bg-white";
  const valueClass = active ? "text-3xl font-semibold text-white" : tone === "rose" ? "text-3xl font-semibold text-rose-800" : "text-3xl font-semibold text-zinc-950";
  const labelClass = active ? "text-white/75" : "text-zinc-500";

  return (
    <button
      aria-pressed={active}
      className={`rounded-lg border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-300 ${borderClass}`}
      onClick={onClick}
      type="button"
    >
      <p className={valueClass}>{value}</p>
      <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${labelClass}`}>{label}</p>
    </button>
  );
}

function OrdersWorkspace({
  couriers,
  orders,
  orderItems,
  selectedOrder,
  shipments,
  usersById,
  onSelectOrder,
  onChangeStatus,
  onChangeShipmentStatus,
  onRegisterTracking,
}: {
  couriers: Courier[];
  orders: Order[];
  orderItems: OrderItem[];
  selectedOrder: Order | null;
  shipments: Shipment[];
  usersById: Map<string, UserAccount>;
  onSelectOrder: (orderId: string) => void;
  onChangeStatus: (status: Order["status"], observation: string) => Promise<void>;
  onChangeShipmentStatus: (shipmentId: string, status: ShipmentStatus, observation: string) => Promise<void>;
  onRegisterTracking: (courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string) => Promise<void>;
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
                <tr className="border-b border-zinc-100 hover:bg-stone-50" key={order.id}>
                  <td className="px-5 py-4">
                    <button className="font-semibold text-rose-800" onClick={() => onSelectOrder(order.id)} type="button">
                      #{shortId(order.id)}
                    </button>
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

      <OrderDetail couriers={couriers} order={selectedOrder} items={orderItems} shipments={shipments} onChangeShipmentStatus={onChangeShipmentStatus} onChangeStatus={onChangeStatus} onRegisterTracking={onRegisterTracking} />
    </div>
  );
}

function OrderDetail({
  couriers,
  order,
  items,
  shipments,
  onChangeStatus,
  onChangeShipmentStatus,
  onRegisterTracking,
}: {
  couriers: Courier[];
  order: Order | null;
  items: OrderItem[];
  shipments: Shipment[];
  onChangeShipmentStatus: (shipmentId: string, status: ShipmentStatus, observation: string) => Promise<void>;
  onChangeStatus: (status: Order["status"], observation: string) => Promise<void>;
  onRegisterTracking: (courierId: string, trackingCode: string, externalShipmentCode: string, estimatedDeliveryAt: string) => Promise<void>;
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

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              Estado del pedido
              <select className="admin-input mt-2" value={status} onChange={(event) => setStatus(event.target.value as Order["status"])}>
                {orderStatuses.map((entry) => (
                  <option key={entry} value={entry}>{formatOrderStatus(entry)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Observacion
              <textarea className="admin-input mt-2 min-h-20" value={observation} onChange={(event) => setObservation(event.target.value)} />
            </label>
            <button className="admin-primary-button w-full" disabled={isSubmitting}>Actualizar orden</button>
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
            <form className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-4" onSubmit={handleShipmentStatusSubmit}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Avance del envio</p>
                <h3 className="mt-1 text-lg font-semibold">Actualizar estado</h3>
              </div>
              <label className="block text-sm font-semibold">
                Estado del envio
                <select className="admin-input mt-2" value={shipmentStatus} onChange={(event) => setShipmentStatus(event.target.value as ShipmentStatus)}>
                  {shipmentStatuses.map((entry) => (
                    <option key={entry} value={entry}>{formatShipmentStatus(entry)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Observacion para seguimiento
                <textarea className="admin-input mt-2 min-h-20" value={shipmentObservation} onChange={(event) => setShipmentObservation(event.target.value)} placeholder="Ej. Pedido entregado a Olva Courier." />
              </label>
              <button className="admin-primary-button w-full" disabled={isShipmentStatusSubmitting}>
                {isShipmentStatusSubmitting ? "Actualizando..." : "Actualizar envio"}
              </button>
            </form>
          ) : null}
        </>
      ) : <p className="text-sm text-zinc-500">No hay ordenes registradas.</p>}
    </aside>
  );
}

function PaymentsWorkspace({
  payments,
  selectedPayment,
  receipts,
  reviews,
  ordersById,
  usersById,
  canReviewPayment,
  onSelectPayment,
  onReview,
}: {
  payments: Payment[];
  selectedPayment: Payment | null;
  receipts: PaymentReceipt[];
  reviews: PaymentReview[];
  ordersById: Map<string, Order>;
  usersById: Map<string, UserAccount>;
  canReviewPayment: boolean;
  onSelectPayment: (paymentId: string) => void;
  onReview: (result: PaymentReviewResult, observation: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <PanelHeader eyebrow="Pagos" title="Comprobantes y pasarela" text="Revisa pagos pendientes, comprobantes cargados y estado de validacion." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-zinc-200 bg-stone-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Pago</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const order = ordersById.get(payment.orderId);
                return (
                  <tr className="border-b border-zinc-100 hover:bg-stone-50" key={payment.id}>
                    <td className="px-5 py-4">
                      <button className="font-semibold text-rose-800" onClick={() => onSelectPayment(payment.id)} type="button">
                        #{shortId(payment.id)}
                      </button>
                    </td>
                    <td className="px-5 py-4">{order ? usersById.get(order.userId)?.email ?? shortId(order.userId) : "Sin orden"}</td>
                    <td className="px-5 py-4"><StatusBadge label={formatPaymentStatus(payment.status)} /></td>
                    <td className="px-5 py-4 font-semibold">{formatMoney(payment.amount, payment.currency)}</td>
                    <td className="px-5 py-4 text-zinc-500">{payment.receiptUploadedAt ? formatDate(payment.receiptUploadedAt) : "Pendiente"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <PaymentDetail canReviewPayment={canReviewPayment} payment={selectedPayment} receipts={receipts} reviews={reviews} onReview={onReview} />
    </div>
  );
}

function PaymentDetail({
  canReviewPayment,
  payment,
  receipts,
  reviews,
  onReview,
}: {
  canReviewPayment: boolean;
  payment: Payment | null;
  receipts: PaymentReceipt[];
  reviews: PaymentReview[];
  onReview: (result: PaymentReviewResult, observation: string) => Promise<void>;
}) {
  const [observation, setObservation] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReview(result: PaymentReviewResult) {
    if (result === "rejected" && !observation.trim()) {
      setReviewMessage("Escribe el motivo del rechazo para que el cliente pueda corregir el comprobante.");
      return;
    }

    setIsSubmitting(true);
    setReviewMessage("");
    try {
      await onReview(result, observation.trim());
      setObservation("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
      <PanelHeader eyebrow="Revision" title={payment ? `Pago #${shortId(payment.id)}` : "Sin seleccion"} text="Aprueba o rechaza comprobantes manuales." />
      {payment ? (
        <>
          <div className="space-y-3 border-y border-zinc-200 py-4 text-sm">
            <SummaryRow label="Estado" value={formatPaymentStatus(payment.status)} />
            <SummaryRow label="Monto" value={formatMoney(payment.amount, payment.currency)} strong />
            <SummaryRow label="Orden" value={`#${shortId(payment.orderId)}`} />
            {payment.status === "rejected" ? <SummaryRow label="Motivo" value={payment.observation || "Sin motivo registrado"} /> : null}
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Comprobantes</h4>
            <div className="mt-3 space-y-3">
              {receipts.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">Sin comprobantes cargados.</p> : null}
              {receipts.map((receipt) => (
                <a className="block rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm hover:border-zinc-950" href={publicAssetUrl(receipt.fileUrl)} key={receipt.id} target="_blank">
                  <span className="font-semibold">Operacion {receipt.operationCode ?? "sin codigo"}</span>
                  <span className="mt-1 block text-zinc-500">{receipt.declaredAmount ? formatMoney(receipt.declaredAmount, receipt.currency ?? payment.currency) : "Monto no declarado"}</span>
                </a>
              ))}
            </div>
          </div>

          {canReviewPayment ? (
            <>
              <label className="mt-5 block text-sm font-semibold">
                Observacion de revision
                <textarea className="admin-input mt-2 min-h-20" value={observation} onChange={(event) => setObservation(event.target.value)} />
              </label>
              {reviewMessage ? <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-900">{reviewMessage}</p> : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button className="admin-primary-button" disabled={isSubmitting} onClick={() => void handleReview("approved")} type="button">Aprobar</button>
                <button className="admin-secondary-button" disabled={isSubmitting} onClick={() => void handleReview("rejected")} type="button">Rechazar</button>
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-lg border border-dashed border-zinc-300 bg-stone-50 p-3 text-sm text-zinc-600">
              Tu rol permite revisar la operacion, pero la aprobacion final de pagos queda reservada al administrador.
            </p>
          )}

          {reviews.length > 0 ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Historial</h4>
              {reviews.map((review) => (
                <p className="mt-3 text-sm text-zinc-600" key={review.id}>
                  <span className="font-semibold text-zinc-950">{review.result === "approved" ? "Aprobado" : "Rechazado"}</span> el {formatDate(review.reviewedAt)}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : <p className="text-sm text-zinc-500">No hay pagos registrados.</p>}
    </aside>
  );
}

function UsersWorkspace({
  users,
  currentUserId,
  onBlockUser,
  onUnblockUser,
}: {
  users: UserAccount[];
  currentUserId: string;
  onBlockUser: (userId: string) => Promise<void>;
  onUnblockUser: (userId: string) => Promise<void>;
}) {
  const [busyUserId, setBusyUserId] = useState("");

  async function handleBlockUser(userId: string) {
    setBusyUserId(userId);
    try {
      await onBlockUser(userId);
    } finally {
      setBusyUserId("");
    }
  }

  async function handleUnblockUser(userId: string) {
    setBusyUserId(userId);
    try {
      await onUnblockUser(userId);
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <PanelHeader eyebrow="Clientes y equipo" title="Usuarios registrados" text="Consulta cuentas, telefonos, estado y administra bloqueos." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-y border-zinc-200 bg-stone-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Telefono</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Alta</th>
              <th className="px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => {
              const isCurrentUser = entry.id === currentUserId;
              const isBlocked = entry.status === "blocked";
              const isBusy = busyUserId === entry.id;
              return (
              <tr className="border-b border-zinc-100" key={entry.id}>
                <td className="px-5 py-4">
                  <p className="font-semibold">{entry.name} {entry.paternalSurname} {entry.maternalSurname ?? ""}</p>
                  <p className="text-zinc-500">{entry.email}{isCurrentUser ? " - sesion actual" : ""}</p>
                </td>
                <td className="px-5 py-4">{entry.phone}</td>
                <td className="px-5 py-4"><StatusBadge label={formatUserStatus(entry.status)} /></td>
                <td className="px-5 py-4 text-zinc-500">{formatDate(entry.createdAt)}</td>
                <td className="px-5 py-4">
                  <button
                    className="mr-2 rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800 transition hover:border-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isCurrentUser || isBlocked || isBusy}
                    onClick={() => void handleBlockUser(entry.id)}
                    type="button"
                  >
                    {isBusy && !isBlocked ? "Procesando..." : "Bloquear"}
                  </button>
                  <button
                    className="rounded-lg border border-emerald-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700 transition hover:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isCurrentUser || !isBlocked || isBusy}
                    onClick={() => void handleUnblockUser(entry.id)}
                    type="button"
                  >
                    {isBusy && isBlocked ? "Procesando..." : "Desbloquear"}
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditWorkspace({
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

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-zinc-600"}>
      <span>{label}</span>
      <span>{value}</span>
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

function formatMoney(amount: number, currency: string) {
  return `S/. ${amount.toFixed(2)} ${currency}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function sortAuditLogs(logs: AuditLog[]) {
  return [...logs].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function isVisibleAuditLog(log: AuditLog) {
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

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function formatAuditAction(action: string) {
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

function formatAuditActionForLog(log: AuditLog) {
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

function formatAuditEntity(entityName: string) {
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

function isTechnicalObservation(observation: string) {
  return observation.includes("_Api.Controllers") || observation.includes(".Controllers.") || observation.includes("(") || observation.includes(")");
}

function formatAuditIp(ipAddress: string | null) {
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

function formatAuditUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return "Sin navegador";
  }

  const browser = getAuditBrowser(userAgent);
  const os = getAuditOperatingSystem(userAgent);
  return `${browser}${os ? ` en ${os}` : ""}`;
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

function formatOrderStatus(status: Order["status"]) {
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

function formatPaymentStatus(status: Payment["status"]) {
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

function formatShipmentStatus(status: ShipmentStatus) {
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

function formatUserStatus(status: UserAccount["status"]) {
  const labels: Record<UserAccount["status"], string> = {
    active: "Activo",
    inactive: "Inactivo",
    blocked: "Bloqueado",
  };
  return labels[status];
}

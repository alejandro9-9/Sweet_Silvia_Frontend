import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminAuditWorkspace } from "@/components/AdminAuditWorkspace";
import { OrdersWorkspace } from "@/components/AdminOrdersWorkspace";
import { PaymentsWorkspace } from "@/components/AdminPaymentsWorkspace";
import { UsersWorkspace } from "@/components/AdminUsersWorkspace";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isVisibleAuditLog, sortAuditLogs } from "@/lib/audit-utils";
import { canAdminister } from "@/lib/roles";
import type { AuditLog, Courier, CreatedResponse, Order, OrderItem, OrderStatusHistory, Payment, PaymentMethod, PaymentReceipt, PaymentReview, Product, Role, Shipment, ShipmentStatus, UserAccount } from "@/lib/types";

type AdminTab = "users" | "orders" | "payments" | "audit";
type PaymentReviewResult = "approved" | "rejected";

export function AdminOperations() {
  const { token, user } = useAuth();
  const canManageUsersAndReviews = canAdminister(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as AdminTab | null;
  const requestedTabIsAvailable = requestedTab === "orders" || requestedTab === "payments" ||
    (canManageUsersAndReviews && (requestedTab === "users" || requestedTab === "audit"));
  const [activeTab, setActiveTab] = useState<AdminTab>(requestedTabIsAvailable ? (requestedTab as AdminTab) : "orders");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderStatusHistory, setOrderStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [reviews, setReviews] = useState<PaymentReview[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shipmentsByOrder, setShipmentsByOrder] = useState<Record<string, Shipment[]>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const operationalOrders = orders;
  const selectedOrder = operationalOrders.find((order) => order.id === selectedOrderId) ?? operationalOrders[0] ?? null;
  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0] ?? null;
  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const ordersById = useMemo(() => new Map(orders.map((entry) => [entry.id, entry])), [orders]);
  const productsById = useMemo(() => new Map(products.map((entry) => [entry.id, entry])), [products]);
  const visibleAuditLogs = useMemo(() => auditLogs.filter(isVisibleAuditLog), [auditLogs]);
  const selectedOrderShipments = selectedOrder ? shipmentsByOrder[selectedOrder.id] ?? [] : [];
  const cashPaymentMethodIds = useMemo(() => new Set(paymentMethods.filter((method) => method.type === "cash").map((method) => method.id)), [paymentMethods]);
  const pendingPayments = payments.filter((payment) => payment.status === "inReview" || (payment.status === "pendingReceipt" && cashPaymentMethodIds.has(payment.paymentMethodId)));
  const canReviewSelectedPayment = canManageUsersAndReviews && selectedPayment !== null &&
    (selectedPayment.status === "inReview" || (selectedPayment.status === "pendingReceipt" && cashPaymentMethodIds.has(selectedPayment.paymentMethodId)));

  useEffect(() => {
    setActiveTab(requestedTabIsAvailable ? (requestedTab as AdminTab) : "orders");
  }, [requestedTab, requestedTabIsAvailable]);

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  }

  async function runOperation(action: () => Promise<void>, fallback: string) {
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    }
  }

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      Promise.all([
        canManageUsersAndReviews ? apiRequest<UserAccount[]>("/api/users", { token }) : Promise.resolve<UserAccount[]>([]),
        canManageUsersAndReviews ? apiRequest<Role[]>("/api/roles?onlyActive=true", { token }) : Promise.resolve<Role[]>([]),
        apiRequest<Order[]>("/api/orders", { token }),
        apiRequest<Payment[]>("/api/payments", { token }),
        apiRequest<PaymentMethod[]>("/api/payment-methods?onlyActive=false", { token }),
        canManageUsersAndReviews ? apiRequest<AuditLog[]>("/api/audit-logs", { token }) : Promise.resolve<AuditLog[]>([]),
        apiRequest<Product[]>("/api/products?onlyActive=false", { token }),
        apiRequest<Courier[]>("/api/couriers", { token }).catch(() => []),
      ])
        .then(async ([nextUsers, nextRoles, nextOrders, nextPayments, nextPaymentMethods, nextAuditLogs, nextProducts, nextCouriers]) => {
          const shipmentPairs = await Promise.all(
            nextOrders
              .map(async (order) => ({
                orderId: order.id,
                shipments: await apiRequest<Shipment[]>(`/api/shipments/order/${order.id}`, { token }).catch(() => []),
              })),
          );
          if (!isActive) {
            return;
          }
          setUsers(nextUsers);
          setRoles(nextRoles);
          setOrders(nextOrders);
          setPayments(nextPayments);
          setPaymentMethods(nextPaymentMethods);
          setProducts(nextProducts);
          setCouriers(nextCouriers);
          setShipmentsByOrder(Object.fromEntries(shipmentPairs.map((entry) => [entry.orderId, entry.shipments])));
          setAuditLogs(sortAuditLogs(nextAuditLogs));
          setSelectedOrderId(nextOrders[0]?.id ?? "");
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
      const timeoutId = window.setTimeout(() => {
        setOrderItems([]);
        setOrderStatusHistory([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      Promise.all([
        apiRequest<OrderItem[]>(`/api/order-items/order/${selectedOrderId}`, { token }),
        apiRequest<OrderStatusHistory[]>(`/api/order-status-history/order/${selectedOrderId}`, { token }).catch(() => []),
      ])
        .then(([nextItems, nextHistory]) => {
          if (isActive) {
            setOrderItems(nextItems);
            setOrderStatusHistory(nextHistory);
          }
        })
        .catch((error: Error) => {
          if (isActive) {
            setOrderItems([]);
            setOrderStatusHistory([]);
            setMessage(error.message);
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
    setOrderStatusHistory(await apiRequest<OrderStatusHistory[]>(`/api/order-status-history/order/${selectedOrder.id}`, { token }).catch(() => []));
    setMessage("Estado de orden actualizado.");
  }

  async function refreshOrderShipments(orderId: string) {
    const nextShipments = await apiRequest<Shipment[]>(`/api/shipments/order/${orderId}`, { token });
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

  async function createShipmentEvent(shipmentId: string, status: ShipmentStatus, description: string, location: string, eventDate: string) {
    if (!selectedOrder) {
      return;
    }

    await apiRequest<CreatedResponse>("/api/shipment-events", {
      method: "POST",
      body: {
        shipmentId,
        status,
        description: description.trim(),
        location: location.trim() || null,
        eventDate: new Date(eventDate || Date.now()).toISOString(),
      },
      token,
    });
    await refreshOrderShipments(selectedOrder.id);
    setMessage("Evento de envio registrado.");
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

  async function changeUserRole(userId: string, roleId: string) {
    await apiRequest<void>(`/api/users/${userId}/role`, {
      method: "PATCH",
      body: { roleId },
      token,
    });
    const nextUsers = await apiRequest<UserAccount[]>("/api/users", { token });
    setUsers(nextUsers);
    setMessage("Rol actualizado correctamente. La nueva sesión tomará el cambio al volver a iniciar sesión.");
  }

  function openPaymentsTab(preferPending = false) {
    selectTab("payments");
    if (preferPending) {
      setSelectedPaymentId(pendingPayments[0]?.id ?? payments[0]?.id ?? "");
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-5">
        {canManageUsersAndReviews ? <OperationMetric active={activeTab === "users"} label="Usuarios" value={users.length} onClick={() => selectTab("users")} /> : null}
        <OperationMetric active={activeTab === "orders"} label="Ordenes" value={operationalOrders.length} onClick={() => selectTab("orders")} />
        <OperationMetric active={activeTab === "payments"} label="Pagos" value={payments.length} onClick={() => openPaymentsTab()} />
        <OperationMetric active={activeTab === "payments" && pendingPayments.length > 0} label={canManageUsersAndReviews ? "Por revisar" : "Pendientes"} value={pendingPayments.length} tone="rose" onClick={() => openPaymentsTab(true)} />
        {canManageUsersAndReviews ? (
          <OperationMetric active={activeTab === "audit"} label="Auditoria" value={visibleAuditLogs.length} onClick={() => selectTab("audit")} />
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
          statusHistory={orderStatusHistory}
          shipments={selectedOrderShipments}
          usersById={usersById}
          onChangeStatus={(status, observation) => runOperation(() => changeOrderStatus(status, observation), "No se pudo actualizar la orden.")}
          onChangeShipmentStatus={(shipmentId, status, observation) => runOperation(() => changeShipmentStatus(shipmentId, status, observation), "No se pudo actualizar el envio.")}
          onRegisterTracking={(courierId, trackingCode, externalShipmentCode, estimatedDeliveryAt) => runOperation(() => registerOrderTracking(courierId, trackingCode, externalShipmentCode, estimatedDeliveryAt), "No se pudo guardar el seguimiento.")}
          onCreateShipmentEvent={(shipmentId, status, description, location, eventDate) => runOperation(() => createShipmentEvent(shipmentId, status, description, location, eventDate), "No se pudo registrar el evento.")}
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
          canReviewPayment={canReviewSelectedPayment}
          onReview={(result, observation) => runOperation(() => reviewPayment(result, observation), "No se pudo registrar la revision del pago.")}
          onSelectPayment={setSelectedPaymentId}
          token={token}
        />
      ) : null}

      {activeTab === "users" && canManageUsersAndReviews ? <UsersWorkspace currentUserId={user?.id ?? ""} roles={roles} users={users} onBlockUser={(userId) => runOperation(() => blockUser(userId), "No se pudo bloquear el usuario.")} onChangeRole={(userId, roleId) => runOperation(() => changeUserRole(userId, roleId), "No se pudo actualizar el rol.")} onUnblockUser={(userId) => runOperation(() => unblockUser(userId), "No se pudo desbloquear el usuario.")} /> : null}
      {activeTab === "audit" && canManageUsersAndReviews ? <AdminAuditWorkspace auditLogs={visibleAuditLogs} productsById={productsById} usersById={usersById} /> : null}
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

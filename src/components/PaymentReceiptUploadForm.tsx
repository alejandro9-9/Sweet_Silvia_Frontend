import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, shortId } from "@/lib/format";
import { formatOrderStatus, formatPaymentStatus } from "@/lib/order-format";
import type { Order, Payment, UploadResult } from "@/lib/types";
type PaymentReceiptUploadFormProps = {
  fixedOrder?: Order;
  fixedPayment?: Payment;
  onUploaded?: () => void | Promise<void>;
  submitLabel?: string;
};

export function PaymentReceiptUploadForm({ fixedOrder, fixedPayment, onUploaded, submitLabel }: PaymentReceiptUploadFormProps = {}) {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ordersById, setOrdersById] = useState<Map<string, Order>>(new Map());
  const [paymentId, setPaymentId] = useState("");
  const [operationCode, setOperationCode] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Selecciona una orden abierta y adjunta el comprobante.");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const eligiblePayments = useMemo(() => payments.filter((payment) => isPaymentOpenForReceipt(payment, ordersById.get(payment.orderId))), [ordersById, payments]);
  const isFixedPayment = Boolean(fixedPayment);

  useEffect(() => {
    let isActive = true;

    if (fixedPayment) {
      const timeoutId = window.setTimeout(() => {
        const nextOrdersById = new Map<string, Order>();
        if (fixedOrder) {
          nextOrdersById.set(fixedOrder.id, fixedOrder);
        }

        setPayments([fixedPayment]);
        setOrdersById(nextOrdersById);
        setPaymentId(fixedPayment.id);
        setDeclaredAmount(String(fixedPayment.amount));
        setMessage(isPaymentOpenForReceipt(fixedPayment, fixedOrder) ? "Adjunta un comprobante para esta orden." : "Este pago ya no admite cambios de comprobante.");
        setIsLoadingPayments(false);
      }, 0);

      return () => {
        isActive = false;
        window.clearTimeout(timeoutId);
      };
    }

    apiRequest<Order[]>("/api/orders/me", { token })
      .then(async (orders) => {
        const openOrders = orders.filter(isOpenCustomerOrder);
        const paymentGroups = await Promise.all(
          openOrders.map((order) => apiRequest<Payment[]>(`/api/payments/order/${order.id}`, { token }).catch(() => [])),
        );

        if (!isActive) {
          return;
        }

        const nextPayments = paymentGroups.flat();
        const nextOrdersById = new Map(openOrders.map((order) => [order.id, order]));
        const firstEligiblePayment = nextPayments.find((payment) => isPaymentOpenForReceipt(payment, nextOrdersById.get(payment.orderId)));
        setPayments(nextPayments);
        setOrdersById(nextOrdersById);
        setPaymentId(firstEligiblePayment?.id ?? "");
        setDeclaredAmount(firstEligiblePayment ? String(firstEligiblePayment.amount) : "");
        setMessage(firstEligiblePayment ? "Selecciona la orden y carga tu comprobante." : "No tienes ordenes abiertas pendientes de comprobante.");
      })
      .catch((error: Error) => {
        if (isActive) {
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPayments(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fixedOrder, fixedPayment, token]);

  function handlePaymentChange(nextPaymentId: string) {
    const payment = payments.find((entry) => entry.id === nextPaymentId);
    setPaymentId(nextPaymentId);
    setDeclaredAmount(payment ? String(payment.amount) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !paymentId) {
      setMessage("Selecciona una orden abierta y un archivo.");
      return;
    }

    const formData = new FormData();
    formData.append("paymentId", paymentId);
    formData.append("operationCode", operationCode);
    if (declaredAmount) {
      formData.append("declaredAmount", declaredAmount);
    }
    formData.append("currency", "PEN");
    formData.append("file", file);

    setIsUploading(true);
    try {
      await apiRequest<UploadResult>("/api/payment-receipts/upload-file", {
        method: "POST",
        body: formData,
        token,
      });
      setMessage(fixedPayment?.status === "rejected" ? "Nuevo comprobante enviado a revision." : "Comprobante subido correctamente.");
      setFile(null);
      setOperationCode("");
      await onUploaded?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir el comprobante.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="space-y-5 rounded-2xl border border-rose-100 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Comprobante de pago</h2>
        <p className="mt-1 text-sm text-zinc-500">Aceptamos imagenes o PDF de hasta 10 MB.</p>
      </div>

      <label className="block text-sm font-medium">
        Orden pendiente
        <select className="admin-input mt-2" disabled={isFixedPayment || isLoadingPayments || eligiblePayments.length === 0} value={paymentId} onChange={(event) => handlePaymentChange(event.target.value)}>
          {isLoadingPayments ? <option value="">Cargando ordenes...</option> : null}
          {!isLoadingPayments && eligiblePayments.length === 0 ? <option value="">Sin ordenes pendientes</option> : null}
          {eligiblePayments.map((payment) => {
            const order = ordersById.get(payment.orderId);
            return (
              <option key={payment.id} value={payment.id}>
                Orden #{shortId(payment.orderId)} - {formatMoney(payment.amount, payment.currency)} - {order ? formatOrderStatus(order.status) : formatPaymentStatus(payment.status)}
              </option>
            );
          })}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Codigo de operacion
          <input className="admin-input mt-2" value={operationCode} onChange={(event) => setOperationCode(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Monto declarado
          <input className="admin-input mt-2" inputMode="decimal" value={declaredAmount} onChange={(event) => setDeclaredAmount(event.target.value)} />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Archivo
        <input className="mt-2 w-full rounded-xl border border-dashed border-rose-200 bg-rose-50/40 px-3 py-3 text-sm" accept=".jpg,.jpeg,.png,.webp,.pdf" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>

      <button className="admin-primary-button" disabled={isUploading || eligiblePayments.length === 0}>
        {isUploading ? "Subiendo..." : submitLabel ?? "Subir comprobante"}
      </button>

      {message ? <p className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-zinc-600">{message}</p> : null}
    </form>
  );
}

function isOpenCustomerOrder(order: Order) {
  return order.status === "pendingReceipt" || order.status === "receiptInReview" || order.status === "paid" || order.status === "preparing" || order.status === "shipped";
}

function isPaymentOpenForReceipt(payment: Payment, order: Order | undefined) {
  if (!order || order.status === "cancelled" || order.status === "delivered" || order.status === "outOfStock") {
    return false;
  }

  return payment.status === "pendingReceipt" || payment.status === "rejected";
}

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, shortId } from "@/lib/format";
import { formatOrderStatus, formatPaymentStatus } from "@/lib/order-format";
import { PaymentInstructions } from "@/components/PaymentInstructions";
import type { Order, Payment, PaymentMethod, UploadResult } from "@/lib/types";
type PaymentReceiptUploadFormProps = {
  fixedOrder?: Order;
  fixedPayment?: Payment;
  initialPaymentId?: string;
  onUploaded?: () => void | Promise<void>;
  submitLabel?: string;
};

export function PaymentReceiptUploadForm({ fixedOrder, fixedPayment, initialPaymentId, onUploaded, submitLabel }: PaymentReceiptUploadFormProps = {}) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [ordersById, setOrdersById] = useState<Map<string, Order>>(new Map());
  const [paymentId, setPaymentId] = useState("");
  const [operationCode, setOperationCode] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Selecciona una orden abierta y adjunta el comprobante.");
  const [uploadConfirmation, setUploadConfirmation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eligiblePayments = useMemo(() => payments.filter((payment) => isPaymentOpenForReceipt(payment, ordersById.get(payment.orderId))), [ordersById, payments]);
  const isFixedPayment = Boolean(fixedPayment);
  const selectedPayment = payments.find((payment) => payment.id === paymentId);
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === selectedPayment?.paymentMethodId);
  const imagePreviewUrl = useMemo(() => {
    if (!file || !isImageFile(file)) {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<PaymentMethod[]>("/api/payment-methods", { token })
      .then(setPaymentMethods)
      .catch(() => setPaymentMethods([]));
  }, [token]);

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
        const firstEligiblePayment = nextPayments.find((payment) => payment.id === initialPaymentId && isPaymentOpenForReceipt(payment, nextOrdersById.get(payment.orderId)))
          ?? nextPayments.find((payment) => isPaymentOpenForReceipt(payment, nextOrdersById.get(payment.orderId)));
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
  }, [fixedOrder, fixedPayment, initialPaymentId, token]);

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
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setOperationCode("");
      setMessage("");
      setUploadConfirmation(true);
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

      <PaymentInstructions paymentMethod={selectedPaymentMethod} />

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

      <div>
        <p className="text-sm font-medium">Comprobante</p>
        <input
          ref={fileInputRef}
          className="sr-only"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          id="payment-receipt-file"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm">
            {imagePreviewUrl ? (
              <div className="flex min-h-56 items-center justify-center bg-zinc-100 p-3 sm:min-h-72">
                <img alt="Vista previa del comprobante seleccionado" className="max-h-72 w-full rounded-lg object-contain shadow-sm" src={imagePreviewUrl} />
              </div>
            ) : (
              <div className="flex min-h-56 items-center justify-center bg-zinc-100 p-6 sm:min-h-72">
                <div className="text-center">
                  <span aria-hidden="true" className="mx-auto flex h-20 w-16 items-center justify-center rounded-lg bg-rose-700 text-lg font-bold tracking-wider text-white shadow-sm">PDF</span>
                  <p className="mt-3 text-sm font-semibold text-zinc-900">Documento PDF seleccionado</p>
                  <p className="mt-1 text-xs text-zinc-500">Se adjuntara al revisar tu pago.</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{file.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{formatFileSize(file.size)} · Listo para adjuntar</p>
              </div>
              <button
                aria-describedby="payment-receipt-file-help"
                className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Cambiar comprobante
              </button>
            </div>
          </div>
        ) : (
          <button
            aria-describedby="payment-receipt-file-help"
            className="mt-2 flex min-h-20 w-full items-center justify-center gap-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/40 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-xl font-normal leading-none text-white">+</span>
            <span>Subir comprobante</span>
          </button>
        )}
        <p id="payment-receipt-file-help" className="mt-2 text-xs leading-5 text-zinc-500">
          {file ? "Revisa que el comprobante sea legible antes de enviarlo." : "JPG, PNG, WEBP o PDF. Maximo 10 MB."}
        </p>
      </div>

      <button className="admin-primary-button" disabled={isUploading || eligiblePayments.length === 0}>
        {isUploading ? "Subiendo..." : submitLabel ?? "Subir comprobante"}
      </button>

      {message ? <p className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-zinc-600">{message}</p> : null}
      {uploadConfirmation ? (
        <div aria-labelledby="receipt-upload-confirmation-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" role="dialog">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-2xl">
            <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">OK</div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Comprobante recibido</p>
            <h2 id="receipt-upload-confirmation-title" className="mt-2 font-serif text-2xl font-semibold">Enviado correctamente</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Tu comprobante quedo pendiente de revision.</p>
            <button
              autoFocus
              className="admin-primary-button mt-6 w-full"
              onClick={() => {
                setUploadConfirmation(false);
                void onUploaded?.();
                navigate("/");
              }}
              type="button"
            >
              Aceptar
            </button>
          </div>
        </div>
      ) : null}
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

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

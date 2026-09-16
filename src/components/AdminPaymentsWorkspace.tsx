import { useEffect, useState } from "react";
import { PrivateFileLink } from "@/components/PrivateFileLink";
import { formatMoney, shortId } from "@/lib/format";
import { formatDate, formatPaymentStatus } from "@/lib/order-format";
import type { Order, Payment, PaymentReceipt, PaymentReview, UserAccount } from "@/lib/types";

type PaymentReviewResult = "approved" | "rejected";

export function PaymentsWorkspace({
  payments,
  selectedPayment,
  receipts,
  reviews,
  ordersById,
  usersById,
  canReviewPayment,
  onSelectPayment,
  onReview,
  token,
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
  token: string | null;
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
                  <tr
                    aria-label={"Seleccionar pago " + shortId(payment.id)}
                    className={selectedPayment?.id === payment.id ? "cursor-pointer border-b border-zinc-100 bg-stone-100" : "cursor-pointer border-b border-zinc-100 hover:bg-stone-50"}
                    key={payment.id}
                    onClick={() => onSelectPayment(payment.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectPayment(payment.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td className="px-5 py-4">
                      <span className="font-semibold text-rose-800">#{shortId(payment.id)}</span>
                    </td>
                    <td className="px-5 py-4">{order ? usersById.get(order.userId)?.email ?? shortId(order.userId) : "Sin orden"}</td>
                    <td className="px-5 py-4"><StatusBadge label={formatPaymentStatus(payment.status)} /></td>
                    <td className="px-5 py-4 font-semibold">{formatMoney(payment.amount, payment.currency)}</td>
                    <td className="px-5 py-4 text-zinc-500">{payment.receiptUploadedAt ? formatDate(payment.receiptUploadedAt) : "Pendiente"}</td>
                  </tr>
                );
              })}
              {payments.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-zinc-500" colSpan={5}>
                    Aun no hay pagos registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <PaymentDetail canReviewPayment={canReviewPayment} payment={selectedPayment} receipts={receipts} reviews={reviews} token={token} onReview={onReview} />
    </div>
  );
}

function PaymentDetail({
  canReviewPayment,
  payment,
  receipts,
  reviews,
  token,
  onReview,
}: {
  canReviewPayment: boolean;
  payment: Payment | null;
  receipts: PaymentReceipt[];
  reviews: PaymentReview[];
  token: string | null;
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
                <div key={receipt.id}>
                  <PrivateFileLink
                    className="block rounded-lg border border-zinc-200 bg-stone-50 p-3 text-sm hover:border-zinc-950"
                    label={`Operacion ${receipt.operationCode ?? "sin codigo"}`}
                    path={`/api/payment-receipts/${receipt.id}/file`}
                    token={token}
                  />
                  <p className="-mt-2 px-3 text-xs text-zinc-500">{receipt.declaredAmount ? formatMoney(receipt.declaredAmount, receipt.currency ?? payment.currency) : "Monto no declarado"}</p>
                </div>
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

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-zinc-600"}><span>{label}</span><span>{value}</span></div>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-700">{label}</span>;
}



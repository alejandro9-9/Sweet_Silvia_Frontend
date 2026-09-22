import { useEffect, useState } from "react";
import { AdminPagination } from "@/components/AdminPagination";
import { apiDownload } from "@/lib/api";
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
  const [previewPaymentId, setPreviewPaymentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const previewPayment = payments.find((payment) => payment.id === previewPaymentId) ?? null;
  const pageCount = Math.max(1, Math.ceil(payments.length / pageSize));
  const visiblePayments = payments.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  const [previewReceipt, setPreviewReceipt] = useState<PaymentReceipt | null>(null);

  useEffect(() => {
    setPreviewReceipt(null);
  }, [selectedPayment?.id]);

  return (
    <div>
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
              {visiblePayments.map((payment) => {
                const order = ordersById.get(payment.orderId);
                const needsAttention = payment.status === "inReview";
                return (
                  <tr
                    aria-label={"Seleccionar pago " + shortId(payment.id)}
                    className={`${selectedPayment?.id === payment.id ? "bg-stone-100" : needsAttention ? "bg-rose-50/20 hover:bg-rose-50/50" : "hover:bg-stone-50"} cursor-pointer border-b border-zinc-100 ${needsAttention ? "border-l-4 border-l-rose-500" : "border-l-0"}`}
                    key={payment.id}
                    onClick={() => {
                      onSelectPayment(payment.id);
                      setPreviewPaymentId(payment.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectPayment(payment.id);
                        setPreviewPaymentId(payment.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td className={`px-5 py-4 ${needsAttention ? "font-bold text-rose-900" : ""}`}>
                      <span className="font-semibold text-rose-800">#{shortId(payment.id)}</span>
                    </td>
                    <td className={`px-5 py-4 ${needsAttention ? "font-bold text-rose-900" : ""}`}>{order ? usersById.get(order.userId)?.email ?? shortId(order.userId) : "Sin orden"}</td>
                    <td className="px-5 py-4"><StatusBadge attention={needsAttention} label={formatPaymentStatus(payment.status)} /></td>
                    <td className={`px-5 py-4 font-semibold ${needsAttention ? "font-bold text-rose-900" : ""}`}>{formatMoney(payment.amount, payment.currency)}</td>
                    <td className={`px-5 py-4 ${needsAttention ? "font-semibold text-rose-800" : "text-zinc-500"}`}>{payment.receiptUploadedAt ? formatDate(payment.receiptUploadedAt) : "Pendiente"}</td>
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
        <AdminPagination page={page} pageCount={pageCount} total={payments.length} onPageChange={setPage} />
      </section>

      {previewPayment ? <PaymentActionModal canReviewPayment={selectedPayment?.id === previewPayment.id && canReviewPayment} payment={previewPayment} receipts={selectedPayment?.id === previewPayment.id ? receipts : []} reviews={selectedPayment?.id === previewPayment.id ? reviews : []} onReview={onReview} token={token} onPreviewReceipt={setPreviewReceipt} previewReceipt={previewReceipt} onClose={() => { setPreviewPaymentId(null); setPreviewReceipt(null); }} /> : null}
    </div>
  );
}

function PaymentActionModal({
  canReviewPayment,
  payment,
  receipts,
  reviews,
  token,
  onReview,
  onPreviewReceipt,
  previewReceipt,
  onClose,
}: {
  canReviewPayment: boolean;
  payment: Payment;
  receipts: PaymentReceipt[];
  reviews: PaymentReview[];
  token: string | null;
  onReview: (result: PaymentReviewResult, observation: string) => Promise<void>;
  onPreviewReceipt: (receipt: PaymentReceipt | null) => void;
  previewReceipt: PaymentReceipt | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4" role="presentation" onClick={onClose}>
      <section className="max-h-[min(94vh,820px)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={`Revisar pago ${shortId(payment.id)}`} onClick={(event) => event.stopPropagation()}>
        <PaymentDetail canReviewPayment={canReviewPayment} payment={payment} receipts={receipts} reviews={reviews} modal onClose={onClose} onReview={onReview} onPreviewReceipt={onPreviewReceipt} />
        {previewReceipt ? <ReceiptPreviewModal payment={payment} receipt={previewReceipt} token={token} onClose={() => onPreviewReceipt(null)} /> : null}
      </section>
    </div>
  );
}

function PaymentDetail({
  canReviewPayment,
  payment,
  receipts,
  reviews,
  modal = false,
  onClose,
  onReview,
  onPreviewReceipt,
}: {
  canReviewPayment: boolean;
  payment: Payment | null;
  receipts: PaymentReceipt[];
  reviews: PaymentReview[];
  modal?: boolean;
  onClose?: () => void;
  onReview: (result: PaymentReviewResult, observation: string) => Promise<void>;
  onPreviewReceipt: (receipt: PaymentReceipt | null) => void;
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
    <aside className={modal ? "relative p-5" : "h-fit rounded-lg border border-zinc-200 bg-white p-5 shadow-sm xl:sticky xl:top-6"}>
      {modal && onClose ? <button aria-label="Cerrar revision de pago" className="absolute right-5 top-5 z-10 admin-secondary-button" onClick={onClose} type="button">Cerrar</button> : null}
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
                <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-stone-50" key={receipt.id}>
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">Operacion {receipt.operationCode ?? "sin codigo"}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{receipt.declaredAmount ? formatMoney(receipt.declaredAmount, receipt.currency ?? payment.currency) : "Monto no declarado"}</p>
                    </div>
                    <button className="admin-secondary-button shrink-0 px-3 py-2 text-xs" onClick={() => onPreviewReceipt(receipt)} type="button">Ver comprobante</button>
                  </div>
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

function ReceiptPreviewModal({
  payment,
  receipt,
  token,
  onClose,
}: {
  payment: Payment;
  receipt: PaymentReceipt;
  token: string | null;
  onClose: () => void;
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;
    setFileUrl(null);
    setFileType("");
    setError("");
    setIsLoading(true);

    apiDownload(`/api/payment-receipts/${receipt.id}/file`, token)
      .then((blob) => {
        if (!isActive) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
        setFileType(blob.type.toLowerCase() || inferReceiptFileType(receipt.fileUrl));
      })
      .catch((downloadError) => {
        if (isActive) {
          setError(downloadError instanceof Error ? downloadError.message : "No se pudo abrir el comprobante.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [receipt.fileUrl, receipt.id, token]);

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

  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf" || fileType.endsWith("/pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4" role="presentation" onClick={onClose}>
      <section className="flex max-h-[min(92vh,860px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">Comprobante de pago</p>
            <h2 className="mt-1 text-xl font-semibold" id="receipt-preview-title">Operacion {receipt.operationCode ?? "sin codigo"}</h2>
            <p className="mt-1 text-sm text-zinc-600">{formatMoney(receipt.declaredAmount ?? payment.amount, receipt.currency ?? payment.currency)} · Pago #{shortId(payment.id)}</p>
          </div>
          <button aria-label="Cerrar comprobante" className="admin-secondary-button shrink-0" onClick={onClose} type="button">Cerrar</button>
        </header>

        <div className="flex min-h-[300px] items-center justify-center overflow-auto bg-zinc-100 p-4">
          {isLoading ? <p className="text-sm text-zinc-600">Cargando comprobante...</p> : null}
          {error ? <p className="max-w-md rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p> : null}
          {!isLoading && !error && fileUrl && isImage ? <img alt={`Comprobante de la operacion ${receipt.operationCode ?? ""}`} className="max-h-[66vh] max-w-full rounded-lg object-contain shadow-sm" src={fileUrl} /> : null}
          {!isLoading && !error && fileUrl && isPdf ? <iframe className="h-[66vh] w-full rounded-lg border border-zinc-200 bg-white" title={`Comprobante de la operacion ${receipt.operationCode ?? ""}`} src={fileUrl} /> : null}
          {!isLoading && !error && fileUrl && !isImage && !isPdf ? <p className="text-sm text-zinc-600">Este archivo no tiene una vista previa disponible.</p> : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-stone-50 px-5 py-3">
          <p className="text-xs text-zinc-500">Revisa que el monto, la fecha y la operacion coincidan antes de aprobar.</p>
          <div className="flex gap-2">
            {fileUrl ? <a className="admin-secondary-button" download={`comprobante-${receipt.operationCode ?? receipt.id}`} href={fileUrl} rel="noreferrer" target="_blank">Abrir archivo</a> : null}
            <button className="admin-primary-button" onClick={onClose} type="button">Cerrar vista</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function inferReceiptFileType(fileUrl: string) {
  const normalizedPath = fileUrl.toLowerCase().split("?")[0];
  if (/\.(png|jpe?g|webp|gif)$/.test(normalizedPath)) {
    return normalizedPath.endsWith(".png") ? "image/png" : normalizedPath.endsWith(".webp") ? "image/webp" : normalizedPath.endsWith(".gif") ? "image/gif" : "image/jpeg";
  }
  return normalizedPath.endsWith(".pdf") ? "application/pdf" : "";
}

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-zinc-600"}><span>{label}</span><span>{value}</span></div>;
}

function StatusBadge({ attention = false, label }: { attention?: boolean; label: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${attention ? "bg-rose-100 text-rose-800" : "bg-stone-100 text-zinc-700"}`}>{label}</span>;
}

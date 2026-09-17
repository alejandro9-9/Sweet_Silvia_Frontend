import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/RouterLink";
import { apiRequest } from "@/lib/api";
import type { Order, Payment, PaymentMethod } from "@/lib/types";

type PendingAction = {
  count: number;
  detail: string;
  href: string;
  label: string;
  marker: string;
};

export function AdminPendingActionsIcon({ token }: { token: string | null }) {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingCount = actions.reduce((total, action) => total + action.count, 0);
  const label = pendingCount > 0
    ? `${pendingCount} accion${pendingCount === 1 ? "" : "es"} pendiente${pendingCount === 1 ? "" : "s"}`
    : "Ver acciones pendientes";

  useEffect(() => {
    let isActive = true;

    async function loadPendingActions() {
      try {
        const [orders, payments, paymentMethods] = await Promise.all([
          apiRequest<Order[]>("/api/orders", { token }),
          apiRequest<Payment[]>("/api/payments", { token }),
          apiRequest<PaymentMethod[]>("/api/payment-methods?onlyActive=false", { token }),
        ]);
        const cashPaymentMethodIds = new Set(paymentMethods.filter((method) => method.type === "cash").map((method) => method.id));
        const paymentsToReview = payments.filter((payment) => payment.status === "inReview" || (payment.status === "pendingReceipt" && cashPaymentMethodIds.has(payment.paymentMethodId))).length;
        const paidOrders = orders.filter((order) => order.status === "paid").length;
        const preparedOrders = orders.filter((order) => order.status === "preparing").length;
        const nextActions: PendingAction[] = [
          {
            count: paymentsToReview,
            detail: "Comprobantes y pagos esperan tu revisión.",
            href: "/admin/operations?tab=payments",
            label: "Revisar comprobantes",
            marker: "C",
          },
          {
            count: paidOrders,
            detail: "Pedidos pagados listos para preparar.",
            href: "/admin/operations?tab=orders&filter=prepare",
            label: "Preparar pedidos",
            marker: "P",
          },
          {
            count: preparedOrders,
            detail: "Pedidos preparados listos para enviar.",
            href: "/admin/operations?tab=orders&filter=shipping",
            label: "Gestionar envíos",
            marker: "E",
          },
        ].filter((action) => action.count > 0);

        if (isActive) {
          setActions(nextActions);
        }
      } catch {
        if (isActive) {
          setActions([]);
        }
      }
    }

    void loadPendingActions();
    const refreshId = window.setInterval(loadPendingActions, 60_000);
    return () => {
      isActive = false;
      window.clearInterval(refreshId);
    };
  }, [token]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className="relative inline-grid size-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
        onClick={() => setIsOpen((current) => !current)}
        title={label}
        type="button"
      >
        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
        {pendingCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-700 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-30 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl" role="menu">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Notificaciones</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">Acciones pendientes</p>
            </div>
            {pendingCount > 0 ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">{pendingCount}</span> : null}
          </div>

          {actions.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {actions.map((action) => (
                <Link
                  className="group relative flex gap-3 border-b border-zinc-100 border-l-4 border-l-rose-600 px-4 py-3 transition hover:bg-rose-50/50"
                  href={action.href}
                  key={action.label}
                  onClick={() => setIsOpen(false)}
                  role="menuitem"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-bold text-rose-800">{action.marker}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-zinc-950">{action.label}</span>
                      <span className="shrink-0 text-xs font-bold text-rose-700">{action.count}</span>
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-rose-900">{action.detail}</span>
                    <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-700">Ver ahora</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No hay acciones pendientes.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { Link } from "@/components/RouterLink";
import { useCustomerPaymentStatus } from "@/components/useCustomerPaymentStatus";

export function CustomerPaymentStatusIcon({ token }: { token: string | null }) {
  const { isLoading, orders } = useCustomerPaymentStatus(token);

  if (!token || isLoading) {
    return null;
  }

  const pendingCount = orders.filter(({ status }) => status === "pendingReceipt" || status === "rejected").length;
  const label = pendingCount > 0
    ? `${pendingCount} comprobante${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"}`
    : "Ver estado de comprobantes";

  return (
    <Link
      aria-label={label}
      className="relative inline-grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white/70 text-zinc-950 shadow-sm transition hover:border-zinc-950 hover:bg-white"
      href="/profile?section=receipts"
      title={label}
    >
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="M7 3.75h7.2L18.5 8v12.25H7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        <path d="M14 3.75V8h4.5M9.5 12h6M9.5 15h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        <path d="m15.5 17 1.25 1.25L19.5 15.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      </svg>
      {pendingCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-700 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-[#f8f5f0]">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      ) : null}
    </Link>
  );
}

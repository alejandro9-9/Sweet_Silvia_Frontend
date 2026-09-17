import { AppShell, RoleGate } from "@/components/AppShell";
import { PaymentReceiptUploadForm } from "@/components/PaymentReceiptUploadForm";
import { useSearchParams } from "react-router-dom";

export default function PaymentsPage() {
  const [searchParams] = useSearchParams();

  return (
    <RoleGate allowedRoles={["Cliente"]}>
      <AppShell>
        <section className="mb-6">
          <h1 className="text-3xl font-semibold">Comprobantes</h1>
          <p className="mt-2 text-zinc-600">
            Adjunta tu comprobante seleccionando una orden abierta.
          </p>
        </section>
        <PaymentReceiptUploadForm initialPaymentId={searchParams.get("paymentId") ?? undefined} />
      </AppShell>
    </RoleGate>
  );
}

"use client";

import { AppShell, RoleGate } from "@/components/AppShell";
import { PaymentReceiptUploadForm } from "@/components/UploadForms";

export default function PaymentsPage() {
  return (
    <RoleGate allowedRoles={["Cliente"]}>
      <AppShell>
        <section className="mb-6">
          <h1 className="text-3xl font-semibold">Comprobantes</h1>
          <p className="mt-2 text-zinc-600">
            Adjunta tu comprobante seleccionando una orden abierta.
          </p>
        </section>
        <PaymentReceiptUploadForm />
      </AppShell>
    </RoleGate>
  );
}

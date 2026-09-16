import { AdminOperations } from "@/components/AdminOperations";
import { AppShell, RoleGate } from "@/components/AppShell";

export default function AdminOperationsPage() {
  return (
    <RoleGate allowedRoles={["Administrador", "Asistente"]}>
      <AppShell>
        <section className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Administracion</p>
          <h1 className="mt-2 text-3xl font-semibold">Operaciones de tienda</h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Gestiona usuarios, ordenes, comprobantes y revisiones de pago desde un panel operativo.
          </p>
        </section>
        <AdminOperations />
      </AppShell>
    </RoleGate>
  );
}

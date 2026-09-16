import { AppShell, RoleGate } from "@/components/AppShell";
import { ProductImageUploadForm } from "@/components/ProductImageUploadForm";

export default function AdminUploadsPage() {
  return (
    <RoleGate allowedRoles={["Administrador", "Asistente"]}>
      <AppShell>
        <section className="mb-6">
          <h1 className="text-3xl font-semibold">Imagenes de producto</h1>
          <p className="mt-2 text-zinc-600">
            Carga fotografias para mantener el catalogo listo para vender.
          </p>
        </section>
        <ProductImageUploadForm />
      </AppShell>
    </RoleGate>
  );
}

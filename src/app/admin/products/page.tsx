"use client";

import { AppShell, RoleGate } from "@/components/AppShell";
import { ProductAdmin } from "@/components/ProductAdmin";

export default function AdminProductsPage() {
  return (
    <RoleGate allowedRoles={["Administrador", "Asistente"]}>
      <AppShell>
        <section className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Administracion</p>
          <h1 className="mt-2 text-3xl font-semibold">Gestion de catalogo</h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Mantiene productos, categorias, colecciones y variantes desde un solo panel.
          </p>
        </section>
        <ProductAdmin />
      </AppShell>
    </RoleGate>
  );
}

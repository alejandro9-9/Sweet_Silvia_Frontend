"use client";

import { useNavigate } from "react-router-dom";
import { Link } from "@/components/RouterLink";
import { useEffect } from "react";
import { AppShell, RoleGate, roleSummary } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { canAdminister, canManageCatalog, canUploadPaymentReceipts } from "@/lib/roles";

export default function DashboardPage() {
  return (
    <RoleGate allowedRoles={["Cliente", "Administrador", "Asistente"]}>
      <DashboardContent />
    </RoleGate>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canManageCatalog(user.role)) {
      navigate("/profile", { replace: true });
    }
  }, [navigate, user]);

  if (!user) {
    return null;
  }

  if (!canManageCatalog(user.role)) {
    return null;
  }

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-rose-100 bg-white/90 p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">{user.role}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hola, {user.email}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{roleSummary(user.role)}</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Trabajo diario</p>
          <h2 className="mt-3 text-xl font-semibold">Accesos rapidos</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Elige una seccion para continuar con tus tareas de tienda.</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {canManageCatalog(user.role) ? <DashboardLink href="/admin/products" title="Catalogo interno" text="Gestiona productos, variantes, categorias y colecciones." /> : null}
        {canManageCatalog(user.role) ? <DashboardLink href="/admin/operations" title="Operaciones" text="Revisa usuarios, ordenes, pagos y comprobantes." /> : null}
        {canManageCatalog(user.role) ? <DashboardLink href="/admin/uploads" title="Imagenes de producto" text="Carga fotos nuevas para el catalogo." /> : null}
        {canManageCatalog(user.role) ? <DashboardLink href="/admin/settings" title="Configuracion operativa" text="Administra cupones, envios, ubicaciones, stock y seguridad." /> : null}
        {canUploadPaymentReceipts(user.role) ? <DashboardLink href="/payments" title="Comprobantes" text="Adjunta comprobantes de tus compras." /> : null}
        {canAdminister(user.role) ? <DashboardLink href="/admin/operations" title="Revision de pagos" text="Aprueba o rechaza comprobantes pendientes." /> : null}
      </section>
    </AppShell>
  );
}

function DashboardLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link className="group rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md" href={href}>
      <span className="mb-5 block h-1.5 w-12 rounded-full bg-rose-200 transition group-hover:bg-rose-500" />
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </Link>
  );
}

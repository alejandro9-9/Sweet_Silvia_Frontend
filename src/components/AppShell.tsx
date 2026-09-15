"use client";

import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "@/components/RouterLink";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/lib/auth";
import { canAdminister, canManageCatalog, canUploadPaymentReceipts } from "@/lib/roles";
import type { ApiRole } from "@/lib/types";

const adminLinks = [
  { href: "/dashboard", label: "Panel", roles: ["Administrador", "Asistente"] as ApiRole[] },
  { href: "/admin/products", label: "Catalogo interno", roles: ["Administrador", "Asistente"] as ApiRole[] },
  { href: "/admin/operations", label: "Operaciones", roles: ["Administrador", "Asistente"] as ApiRole[] },
  { href: "/admin/uploads", label: "Imagenes", roles: ["Administrador", "Asistente"] as ApiRole[] },
  { href: "/admin/settings", label: "Configuracion", roles: ["Administrador", "Asistente"] as ApiRole[] },
];

const customerLinks = [
  { href: "/", label: "Inicio" },
  { href: "/catalog", label: "Catalogo" },
  { href: "/profile", label: "Perfil" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdminArea = pathname.startsWith("/admin") || (pathname === "/dashboard" && Boolean(user && canManageCatalog(user.role)));
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const visibleLinks = user && canManageCatalog(user.role)
    ? adminLinks.filter((link) => link.roles.includes(user.role))
    : customerLinks;
  const homeHref = user && canManageCatalog(user.role) ? "/dashboard" : "/";

  async function handleLogout() {
    await logout();
    setIsAccountMenuOpen(false);
    navigate("/login");
  }

  return (
    <div className={isAdminArea ? "admin-shell flex min-h-screen flex-col text-zinc-950" : "flex min-h-screen flex-col bg-stone-50 text-zinc-950"}>
      <header className={isAdminArea ? "admin-header border-b border-rose-100" : "border-b border-zinc-200 bg-white"}>
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link aria-label="Ir al inicio de Sweet Silvia" href={homeHref}>
            <BrandLogo className="w-36 sm:w-40" priority />
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {visibleLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 font-medium transition ${
                    isActive ? "bg-rose-100 text-rose-900" : isAdminArea ? "text-zinc-700 hover:bg-rose-50 hover:text-rose-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              user.role === "Cliente" ? (
                <div className="relative">
                  <button
                    aria-expanded={isAccountMenuOpen}
                    className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                    onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
                    type="button"
                    title={user.email}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-100 text-rose-800">
                      {user.email.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-52 text-left leading-tight sm:block">
                      <span className="block truncate">{user.email}</span>
                      <span className="block text-xs font-medium text-zinc-500">{user.role}</span>
                    </span>
                  </button>
                  {isAccountMenuOpen ? (
                    <div className="absolute right-0 z-20 mt-3 w-72 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Sweet Silvia</p>
                      <p className="mt-2 truncate text-sm font-semibold">{user.email}</p>
                      <p className="text-xs text-zinc-500">Cliente</p>
                      <div className="mt-4 grid gap-1 border-y border-zinc-100 py-3">
                        <AccountMenuLink href="/profile" label="Perfil y pedidos" onClick={() => setIsAccountMenuOpen(false)} />
                        <AccountMenuLink href="/profile?section=receipts" label="Comprobantes" onClick={() => setIsAccountMenuOpen(false)} />
                        <AccountMenuLink href="/profile?section=tracking" label="Seguimiento" onClick={() => setIsAccountMenuOpen(false)} />
                      </div>
                      <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-zinc-700 hover:bg-rose-50 hover:text-rose-800" onClick={handleLogout} type="button">
                        Cerrar sesion
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="hidden text-right text-sm sm:block">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-zinc-500">{user.role}</p>
                  </div>
                  <button className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-rose-300 hover:bg-rose-50" onClick={handleLogout}>
                    Salir
                  </button>
                </>
              )
            ) : (
              <Link className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white" href="/login">
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      {!isAdminArea ? <SiteFooter /> : null}
    </div>
  );
}

function AccountMenuLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-rose-50 hover:text-rose-800" href={href} onClick={onClick}>
      {label}
    </Link>
  );
}

export function RoleGate({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: ApiRole[];
}) {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const isAllowed = Boolean(user && allowedRoles.includes(user.role));

  useEffect(() => {
    if (isReady && !user) {
      navigate("/login", { replace: true });
    }
  }, [isReady, navigate, user]);

  if (!isReady) {
    return <ScreenMessage title="Un momento" text="Estamos abriendo tu cuenta." />;
  }

  if (!user) {
    return <ScreenMessage title="Ingresa a tu cuenta" text="Esta seccion necesita una sesion activa." />;
  }

  if (!isAllowed) {
    return <ScreenMessage title="Acceso restringido" text="Esta seccion no esta disponible para tu cuenta." />;
  }

  return children;
}

export function ScreenMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-zinc-600">{text}</p>
    </div>
  );
}

export function roleSummary(role: ApiRole) {
  if (canAdminister(role)) {
    return "Gestiona catalogo, clientes, pagos, stock, envios, auditoria y archivos.";
  }

  if (canManageCatalog(role)) {
    return "Acompana la operacion diaria: productos, pedidos, pagos, envios e imagenes.";
  }

  if (canUploadPaymentReceipts(role)) {
    return "Revisa tus pedidos, direcciones, pagos y comprobantes.";
  }

  return "Sesion activa.";
}

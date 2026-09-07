"use client";

import { Suspense } from "react";
import { AppShell, RoleGate } from "@/components/AppShell";
import { CustomerProfile } from "@/components/CustomerProfile";

export default function ProfilePage() {
  return (
    <RoleGate allowedRoles={["Cliente"]}>
      <AppShell>
        <Suspense fallback={<p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Cargando perfil...</p>}>
          <CustomerProfile />
        </Suspense>
      </AppShell>
    </RoleGate>
  );
}

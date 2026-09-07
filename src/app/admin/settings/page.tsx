"use client";

import { AppShell, RoleGate } from "@/components/AppShell";
import { AdminSettings } from "@/components/AdminSettings";

export default function AdminSettingsPage() {
  return (
    <RoleGate allowedRoles={["Administrador", "Asistente"]}>
      <AppShell>
        <AdminSettings />
      </AppShell>
    </RoleGate>
  );
}


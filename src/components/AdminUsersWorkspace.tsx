import { useState } from "react";
import { formatDate, formatUserStatus } from "@/lib/order-format";
import type { Role, UserAccount } from "@/lib/types";

export function UsersWorkspace({
  users,
  roles,
  currentUserId,
  onBlockUser,
  onChangeRole,
  onUnblockUser,
}: {
  users: UserAccount[];
  roles: Role[];
  currentUserId: string;
  onBlockUser: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, roleId: string) => Promise<void>;
  onUnblockUser: (userId: string) => Promise<void>;
}) {
  const [busyUserId, setBusyUserId] = useState("");

  async function handleBlockUser(userId: string) {
    setBusyUserId(userId);
    try {
      await onBlockUser(userId);
    } finally {
      setBusyUserId("");
    }
  }

  async function handleUnblockUser(userId: string) {
    setBusyUserId(userId);
    try {
      await onUnblockUser(userId);
    } finally {
      setBusyUserId("");
    }
  }

  async function handleRoleChange(userId: string, roleId: string) {
    setBusyUserId(userId);
    try {
      await onChangeRole(userId, roleId);
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <PanelHeader eyebrow="Clientes y equipo" title="Usuarios registrados" text="Consulta cuentas, cambia roles y administra bloqueos." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-y border-zinc-200 bg-stone-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Rol</th>
              <th className="px-5 py-3">Telefono</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Alta</th>
              <th className="px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => {
              const isCurrentUser = entry.id === currentUserId;
              const isBlocked = entry.status === "blocked";
              const isBusy = busyUserId === entry.id;
              return (
              <tr className="border-b border-zinc-100" key={entry.id}>
                <td className="px-5 py-4">
                  <p className="font-semibold">{entry.name} {entry.paternalSurname} {entry.maternalSurname ?? ""}</p>
                  <p className="text-zinc-500">{entry.email}{isCurrentUser ? " - sesion actual" : ""}</p>
                </td>
                <td className="px-5 py-4">
                  <select
                    aria-label={`Rol de ${entry.email}`}
                    className="admin-input min-w-40 py-2 text-xs"
                    disabled={isCurrentUser || isBusy}
                    value={entry.roleId}
                    onChange={(event) => {
                      const nextRole = roles.find((role) => role.id === event.target.value);
                      if (event.target.value !== entry.roleId && window.confirm("Cambiar el rol de " + entry.email + " a " + (nextRole?.name ?? "el nuevo rol") + "?")) {
                        void handleRoleChange(entry.id, event.target.value);
                      }
                    }}
                  >
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-4">{entry.phone}</td>
                <td className="px-5 py-4"><StatusBadge label={formatUserStatus(entry.status)} /></td>
                <td className="px-5 py-4 text-zinc-500">{formatDate(entry.createdAt)}</td>
                <td className="px-5 py-4">
                  <button
                    className="mr-2 rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-800 transition hover:border-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isCurrentUser || isBlocked || isBusy}
                    onClick={() => {
                      if (window.confirm("Bloquear a " + entry.email + "?")) {
                        void handleBlockUser(entry.id);
                      }
                    }}
                    type="button"
                  >
                    {isBusy && !isBlocked ? "Procesando..." : "Bloquear"}
                  </button>
                  <button
                    className="rounded-lg border border-emerald-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700 transition hover:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isCurrentUser || !isBlocked || isBusy}
                    onClick={() => void handleUnblockUser(entry.id)}
                    type="button"
                  >
                    {isBusy && isBlocked ? "Procesando..." : "Desbloquear"}
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-zinc-600"}><span>{label}</span><span>{value}</span></div>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-700">{label}</span>;
}


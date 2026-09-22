import { useEffect, useState } from "react";
import { AdminPagination } from "@/components/AdminPagination";
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const visibleUsers = users.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

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
    <div>
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <PanelHeader eyebrow="Clientes y equipo" title="Usuarios registrados" text="Selecciona una cuenta para consultar sus datos y administrar sus permisos." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-y border-zinc-200 bg-stone-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Rol</th>
                <th className="px-5 py-3">Telefono</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Alta</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((entry) => (
                <tr
                  aria-label={`Ver usuario ${entry.email}`}
                  className="cursor-pointer border-b border-zinc-100 hover:bg-stone-50"
                  key={entry.id}
                  onClick={() => setSelectedUserId(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedUserId(entry.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold">{entry.name} {entry.paternalSurname} {entry.maternalSurname ?? ""}</p>
                    <p className="text-zinc-500">{entry.email}{entry.id === currentUserId ? " - sesion actual" : ""}</p>
                  </td>
                  <td className="px-5 py-4">{roles.find((role) => role.id === entry.roleId)?.name ?? "Rol no disponible"}</td>
                  <td className="px-5 py-4">{entry.phone || "Sin telefono"}</td>
                  <td className="px-5 py-4"><StatusBadge label={formatUserStatus(entry.status)} /></td>
                  <td className="px-5 py-4 text-zinc-500">{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
              {visibleUsers.length === 0 ? <tr><td className="px-5 py-8 text-center text-zinc-500" colSpan={5}>No hay usuarios registrados.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} pageCount={pageCount} total={users.length} onPageChange={setPage} />
      </section>
      {selectedUser ? <UserActionModal currentUserId={currentUserId} roles={roles} user={selectedUser} busyUserId={busyUserId} onBlockUser={handleBlockUser} onChangeRole={handleRoleChange} onClose={() => setSelectedUserId(null)} onUnblockUser={handleUnblockUser} /> : null}
    </div>
  );
}

function UserActionModal({
  currentUserId,
  roles,
  user,
  busyUserId,
  onBlockUser,
  onChangeRole,
  onClose,
  onUnblockUser,
}: {
  currentUserId: string;
  roles: Role[];
  user: UserAccount;
  busyUserId: string;
  onBlockUser: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, roleId: string) => Promise<void>;
  onClose: () => void;
  onUnblockUser: (userId: string) => Promise<void>;
}) {
  const isCurrentUser = user.id === currentUserId;
  const isBlocked = user.status === "blocked";
  const isBusy = busyUserId === user.id;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4" role="presentation" onClick={onClose}>
      <section className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Gestionar usuario ${user.email}`} onClick={(event) => event.stopPropagation()}>
        <button aria-label="Cerrar usuario" className="absolute right-5 top-5 admin-secondary-button" onClick={onClose} type="button">Cerrar</button>
        <PanelHeader eyebrow="Detalle de usuario" title={`${user.name} ${user.paternalSurname}`} text="Consulta la cuenta y aplica acciones administrativas desde este detalle." />
        <div className="space-y-3 border-y border-zinc-200 py-4 text-sm">
          <SummaryRow label="Correo" value={user.email} />
          <SummaryRow label="Telefono" value={user.phone || "Sin telefono"} />
          <SummaryRow label="Estado" value={formatUserStatus(user.status)} />
          <SummaryRow label="Registro" value={formatDate(user.createdAt)} />
        </div>
        <label className="mt-5 block text-sm font-semibold">
          Rol
          <select
            aria-label={`Rol de ${user.email}`}
            className="admin-input mt-2"
            disabled={isCurrentUser || isBusy}
            value={user.roleId}
            onChange={(event) => {
              const nextRole = roles.find((role) => role.id === event.target.value);
              if (event.target.value !== user.roleId && window.confirm("Cambiar el rol de " + user.email + " a " + (nextRole?.name ?? "el nuevo rol") + "?")) {
                void onChangeRole(user.id, event.target.value);
              }
            }}
          >
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button className="admin-secondary-button border-rose-200 text-rose-800" disabled={isCurrentUser || isBlocked || isBusy} onClick={() => { if (window.confirm("Bloquear a " + user.email + "?")) void onBlockUser(user.id); }} type="button">{isBusy && !isBlocked ? "Procesando..." : "Bloquear"}</button>
          <button className="admin-secondary-button border-emerald-200 text-emerald-700" disabled={isCurrentUser || !isBlocked || isBusy} onClick={() => void onUnblockUser(user.id)} type="button">{isBusy && isBlocked ? "Procesando..." : "Desbloquear"}</button>
        </div>
      </section>
    </div>
  );
}

function PanelHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-zinc-600"><span>{label}</span><span className="text-right font-medium text-zinc-900">{value}</span></div>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-700">{label}</span>;
}

import { useEffect, useState } from "react";
import { AdminPagination } from "@/components/AdminPagination";

export type SettingsEditorState = { mode: "create" | "edit"; id?: string };

export type SettingsListItem = {
  id: string;
  name: string;
  detail: string;
  status?: string;
};

export function SettingsList({
  items,
  onDelete,
  onEdit,
  onView,
  selectedId,
}: {
  items: SettingsListItem[];
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  selectedId?: string;
}) {
  const [page, setPage] = useState(1);
  const [viewingItem, setViewingItem] = useState<SettingsListItem | null>(null);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500">Sin registros.</p>;
  }

  return (
    <>
      <div className="mt-4 divide-y divide-zinc-100">
        {visibleItems.map((item) => (
          <div
            className={item.id === selectedId ? "flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-zinc-950 px-3 py-3 text-white" : "flex cursor-pointer items-center justify-between gap-4 py-4 hover:bg-stone-50"}
            key={item.id}
            onClick={() => onView ? onView(item.id) : setViewingItem(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (onView) onView(item.id);
                else setViewingItem(item);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{item.name}</p>
              <p className={item.id === selectedId ? "mt-1 truncate text-xs text-zinc-300" : "mt-1 truncate text-xs text-zinc-500"}>{item.detail}</p>
              {item.status ? <span className={item.id === selectedId ? "mt-2 inline-flex rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white" : "mt-2 inline-flex rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600"}>{item.status}</span> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onEdit ? <button aria-label={`Editar ${item.name}`} className="icon-button" onClick={(event) => { event.stopPropagation(); onEdit(item.id); }} title={`Editar ${item.name}`} type="button"><EditIcon /></button> : null}
              {onDelete ? <button aria-label={`Eliminar ${item.name}`} className="icon-button icon-button-danger" onClick={(event) => { event.stopPropagation(); onDelete(item.id); }} title={`Eliminar ${item.name}`} type="button"><TrashIcon /></button> : null}
            </div>
          </div>
        ))}
      </div>
      <AdminPagination page={page} pageCount={pageCount} total={items.length} onPageChange={setPage} />
      {viewingItem ? <SettingsModal title="Detalle" onClose={() => setViewingItem(null)}><dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Nombre</dt><dd className="mt-1 break-words font-semibold">{viewingItem.name}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Detalle</dt><dd className="mt-1 break-words">{viewingItem.detail}</dd></div>{viewingItem.status ? <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Estado</dt><dd className="mt-1 break-words">{viewingItem.status}</dd></div> : null}</dl></SettingsModal> : null}
    </>
  );
}

export function SettingsModal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
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
      <section className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button aria-label="Cerrar" className="icon-button" onClick={onClose} title="Cerrar" type="button"><CloseIcon /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function PlusIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function EditIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="m5 16.5-.75 3.25L7.5 19l10.75-10.75a2.12 2.12 0 0 0-3-3L4.5 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /><path d="m14 6 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="M4.5 7.5h15M9 7.5V5.25h6V7.5m-8.25 0 .75 12h9l.75-12M10 11v5M14 11v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

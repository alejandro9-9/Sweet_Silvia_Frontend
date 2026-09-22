type AdminPaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({ page, pageCount, total, onPageChange }: AdminPaginationProps) {
  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-sm text-zinc-600">
      <span>Mostrando pagina {page} de {pageCount} · {total} registros</span>
      <div className="flex gap-2">
        <button className="admin-secondary-button px-3 py-2 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">Anterior</button>
        <button className="admin-secondary-button px-3 py-2 text-xs" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button">Siguiente</button>
      </div>
    </div>
  );
}

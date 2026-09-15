import { Link } from "@/components/RouterLink";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-[#f8f5f0]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>2026 Sweet Silvia. Todos los derechos reservados.</p>
        <nav aria-label="Informacion legal" className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
          <Link className="transition hover:text-rose-800" href="/terms-and-conditions">
            Terminos y condiciones
          </Link>
          <Link className="transition hover:text-rose-800" href="/privacy-policy">
            Politica de privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}

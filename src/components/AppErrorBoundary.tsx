import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // El monitor del hosting puede capturar el fallo sin exponer detalles internos al cliente.
  }

  reloadPage = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 px-4 text-center text-zinc-950">
        <section className="max-w-md rounded-xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Sweet Silvia</p>
          <h1 className="mt-3 text-2xl font-semibold">No pudimos cargar esta vista</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Actualiza la pagina para intentarlo nuevamente.</p>
          <button
            className="mt-6 rounded-lg bg-zinc-950 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800"
            onClick={this.reloadPage}
            type="button"
          >
            Recargar pagina
          </button>
        </section>
      </main>
    );
  }
}

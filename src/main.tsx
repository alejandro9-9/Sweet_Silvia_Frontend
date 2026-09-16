import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import "@/app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontro el elemento raiz de la aplicacion.");
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

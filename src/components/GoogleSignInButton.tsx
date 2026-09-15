"use client";

import { useEffect, useRef, useState } from "react";
import { clientEnv } from "@/lib/env";

type GoogleSignInButtonProps = {
  actionLabel?: string;
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: { theme: string; size: string; width: number }) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (window.google) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-sweet-silvia-google="true"]');
    const script = existingScript ?? document.createElement("script");

    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar Google Identity.")), { once: true });

    if (!existingScript) {
      script.dataset.sweetSilviaGoogle = "true";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return googleScriptPromise;
}

export function GoogleSignInButton({ actionLabel = "Ingresar con Google", onCredential, onError }: GoogleSignInButtonProps) {
  const clientId = clientEnv.googleClientId;
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !isScriptReady || !window.google || !buttonRef.current) {
      return;
    }

    buttonRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        if (!credential) {
          onError("Google no devolvio una credencial valida.");
          return;
        }

        setIsAuthenticating(true);
        void (async function completeGoogleSignIn() {
          try {
            await callbackRef.current(credential);
          } catch (error: unknown) {
            onError(error instanceof Error ? error.message : "No se pudo iniciar sesion con Google.");
          } finally {
            setIsAuthenticating(false);
          }
        })();
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: Math.min(buttonRef.current.clientWidth || 360, 360),
    });
  }, [clientId, isScriptReady, onError]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    loadGoogleIdentityScript()
      .then(() => {
        setScriptError(false);
        setIsScriptReady(true);
      })
      .catch(() => {
        setScriptError(true);
        onError("No se pudo cargar el acceso de Google. Revisa tu conexion e intentalo nuevamente.");
      });
  }, [clientId, onError]);

  if (!clientId) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#d8c8c8] bg-[#fbf6f4] p-4 text-center">
        <p className="text-sm font-semibold text-[#59484c]">Google no esta disponible</p>
        <p className="mt-1 text-xs leading-5 text-[#8e7c80]">Configura el Client ID web para activar este acceso.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[10px] border border-[#e2d6d3] bg-[#fbf6f4] p-4" aria-busy={isAuthenticating}>
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e2d6d3] bg-white text-base font-bold text-[#4285f4] shadow-sm" aria-hidden="true">G</div>
        <div>
          <p className="text-sm font-semibold text-[#30272b]">{actionLabel}</p>
          <p className="mt-0.5 text-xs text-[#8e7c80]">{actionLabel.startsWith("Registr") ? "Crea tu cuenta de forma rapida y segura." : "Accede de forma rapida y segura."}</p>
        </div>
      </div>

      {scriptError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800" role="alert">
          No se pudo cargar el boton de Google.
        </div>
      ) : (
        <div className="mt-4 min-h-10 w-full min-w-0 max-w-full overflow-hidden" aria-live="polite">
          {!isScriptReady ? <div className="flex min-h-10 items-center justify-center rounded-lg border border-[#e2d6d3] bg-white px-3 text-xs text-[#8e7c80]">Cargando acceso de Google...</div> : null}
        <div className={isScriptReady ? "min-h-10 w-full min-w-0 max-w-full overflow-hidden" : "hidden"} ref={buttonRef} aria-label={actionLabel} />
        </div>
      )}

      {isAuthenticating ? <p className="mt-3 text-center text-xs font-medium text-[#8e7c80]">Verificando tu cuenta...</p> : null}
      <p className="mt-3 text-center text-[11px] leading-4 text-[#a9989b]">Google nunca comparte tu contrasena con Sweet Silvia.</p>
    </div>
  );
}

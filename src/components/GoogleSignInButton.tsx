"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type GoogleSignInButtonProps = {
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

export function GoogleSignInButton({ onCredential, onError }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [isScriptReady, setIsScriptReady] = useState(false);

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

        void callbackRef.current(credential).catch((error: unknown) => {
          onError(error instanceof Error ? error.message : "No se pudo iniciar sesion con Google.");
        });
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: Math.min(buttonRef.current.clientWidth || 360, 360),
    });
  }, [clientId, isScriptReady, onError]);

  if (!clientId) {
    return <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-xs text-zinc-500">Configura NEXT_PUBLIC_GOOGLE_CLIENT_ID para activar Google.</p>;
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setIsScriptReady(true)} />
      <div className="min-h-10 w-full" ref={buttonRef} />
    </>
  );
}

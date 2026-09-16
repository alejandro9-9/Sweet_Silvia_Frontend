import { useEffect, useState } from "react";
import { apiDownload } from "@/lib/api";

type PrivateFileLinkProps = {
  path: string;
  token: string | null;
  label: string;
  className?: string;
};

export function PrivateFileLink({ path, token, label, className = "" }: PrivateFileLinkProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }, [objectUrl]);

  async function openFile() {
    if (!token || isLoading) {
      setMessage("Tu sesion ya no esta disponible.");
      return;
    }

    const newWindow = window.open("about:blank", "_blank");
    setIsLoading(true);
    setMessage("");
    try {
      const blob = await apiDownload(path, token);
      const nextObjectUrl = URL.createObjectURL(blob);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setObjectUrl(nextObjectUrl);
      if (newWindow) {
        newWindow.location.href = nextObjectUrl;
      }
    } catch (error) {
      newWindow?.close();
      setMessage(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <span className={className}>
      <button className="w-full text-left" disabled={isLoading} onClick={() => void openFile()} type="button">
        <span className="font-semibold">{isLoading ? "Abriendo comprobante..." : label}</span>
      </button>
      {message ? <span className="mt-2 block text-xs text-rose-800">{message}</span> : null}
    </span>
  );
}

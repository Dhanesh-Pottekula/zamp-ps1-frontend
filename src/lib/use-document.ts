import { useEffect, useState } from "react";

export type DocumentStatus = "loading" | "ready" | "missing";

/**
 * Ask the server whether a document exists before a frame shows it.
 * A frame cannot tell a PDF from an error page, so without this check a missing document would show the
 * server's error text inside the frame.
 */
export function useDocument(url: string): DocumentStatus {
  const [status, setStatus] = useState<DocumentStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    fetch(url)
      .then((response) => {
        const found = response.ok && !(response.headers.get("content-type") ?? "").startsWith("application/json");
        if (!cancelled) setStatus(found ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return status;
}

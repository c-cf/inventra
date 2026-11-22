import type { ReactNode } from "react";

/** Full-page placeholder for the loading and error states of a signed-in page. */
export function PageStatus({
  message,
  error = false,
  children,
}: {
  message: string;
  error?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl space-y-3 p-6">
        {error ? <p role="alert">{message}</p> : <p>{message}</p>}
        {children}
      </main>
    </div>
  );
}

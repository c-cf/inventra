/** Full-page placeholder for the loading and error states of a signed-in page. */
export function PageStatus({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl p-6">
        {error ? <p role="alert">{message}</p> : <p>{message}</p>}
      </main>
    </div>
  );
}

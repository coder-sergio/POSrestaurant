"use client";
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main className="max-w-xl mx-auto mt-24 card">
      <h1 className="text-2xl font-bold">No pudimos cargar esta vista</h1>
      <p className="my-4 muted">
        Tus operaciones confirmadas permanecen guardadas. Reintenta cargar la
        pantalla.
      </p>
      <button className="btn" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}

"use client";
import { useState } from "react";
import { UtensilsCrossed, ArrowRight, ShieldCheck } from "lucide-react";
export default function Login() {
  const [email, setEmail] = useState("mesero@mesa.local"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "No hay conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <section className="bg-[#143d2b] text-white p-10 md:p-20 flex flex-col justify-between">
        <div className="flex items-center gap-3 text-2xl font-bold">
          <UtensilsCrossed /> mesa
          <span className="text-xs opacity-50 font-normal tracking-widest">
            RESTAURANT OS
          </span>
        </div>
        <div className="my-16">
          <p className="text-green-300 text-sm mb-5">
            UN BUEN SERVICIO EMPIEZA AQUÍ
          </p>
          <h1 className="text-5xl md:text-6xl tracking-tight leading-tight">
            Menos fricción.
            <br />
            Más hospitalidad.
          </h1>
          <p className="mt-6 text-green-100/60 max-w-sm">
            De la primera comanda al último cierre. Todo tu restaurante, en un
            solo lugar.
          </p>
        </div>
        <p className="text-xs text-green-100/50">
          Hecho para el ritmo de tu restaurante.
        </p>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <ShieldCheck className="text-green-700 mb-6" size={32} />
          <h2 className="text-3xl font-bold">Bienvenido de nuevo</h2>
          <p className="muted mt-2 mb-8">
            Inicia tu sesión para comenzar el servicio.
          </p>
          <label className="block text-sm mb-2">Cuenta de trabajo</label>
          <select value={email} onChange={(e) => setEmail(e.target.value)}>
            <option value="mesero@mesa.local">Mesero · Daniel</option>
            <option value="caja@mesa.local">Cajera · Laura</option>
            <option value="admin@mesa.local">Administrador · Sergio</option>
          </select>
          <label className="block text-sm mt-5 mb-2">Contraseña</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs muted mt-3">
            Usa la contraseña configurada al preparar los datos iniciales.
          </p>
          {error && (
            <p role="alert" className="text-red-700 mt-4">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn w-full mt-7">
            {busy ? "Iniciando…" : "Entrar al restaurante"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

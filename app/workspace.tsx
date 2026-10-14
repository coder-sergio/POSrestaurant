"use client";
import { useCallback, useEffect, useState } from "react";
import {
  UtensilsCrossed,
  LayoutGrid,
  Wallet,
  ChartNoAxesCombined,
  LogOut,
  Plus,
  Search,
  X,
  ChefHat,
  ArrowRight,
  Check,
  Printer,
  RefreshCw,
  Users,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Settings2,
  Pencil,
  Trash2,
} from "lucide-react";
import type { User } from "@/lib/auth";
import { command } from "@/lib/schema";
type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: number;
};
type Table = {
  id: number;
  name: string;
  orderId: number | null;
  status: string | null;
  subtotal: number;
};
type Item = {
  id: number;
  order_id: number;
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  note: string;
};
type Payment = {
  id: number;
  order_id: number;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  method: string;
  tendered: number;
};
type Data = {
  products: Product[];
  tables: Table[];
  items: Item[];
  tax: number;
  shift?: { id: number; initial: number } | null;
  totals?: { method: string; total: number; count: number }[];
  history?: {
    id: number;
    initial: number;
    expected: number;
    counted: number | null;
    closed_at: string | null;
  }[];
  kpi?: { sales: number; orders: number; average: number };
  expenses?: { id: number; description: string; amount: number }[];
  chart?: { hour: string; total: number }[];
};
const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
const categories = [
  "Todos",
  "Entradas",
  "Platos Fuertes",
  "Bebidas",
  "Postres",
];
export default function Workspace({ actor }: { actor: User }) {
  const [data, setData] = useState<Data | null>(null),
    [view, setView] = useState(
      actor.role === "CASHIER"
        ? "cash"
        : actor.role === "ADMIN"
          ? "admin"
          : "tables",
    ),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [table, setTable] = useState<Table | null>(null),
    [cart, setCart] = useState<
      { productId: number; quantity: number; note: string }[]
    >([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todos"),
    [pay, setPay] = useState<Table | null>(null),
    [method, setMethod] = useState("CASH"),
    [tip, setTip] = useState(false),
    [tendered, setTendered] = useState(""),
    [receipt, setReceipt] = useState<{
      payment: Payment;
      items: Item[];
    } | null>(null),
    [edit, setEdit] = useState<Partial<Product> | null>(null),
    [expense, setExpense] = useState(false),
    [shiftModal, setShiftModal] = useState<"open" | "close" | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/pos", { cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sin conexión. Reintenta.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function act(input: unknown) {
    setBusy(true);
    try {
      const valid = command.safeParse(input);
      if (!valid.success) throw Error(valid.error.issues[0].message);
      const r = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valid.data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await refresh();
      return d;
    } catch (e) {
      setToast(
        e instanceof Error
          ? e.message
          : "No se pudo conectar. Revisa el estado antes de reintentar.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  const allowed = [
    ...(actor.role !== "CASHIER"
      ? [{ id: "tables", label: "Servicio", icon: LayoutGrid }]
      : []),
    ...(actor.role !== "WAITER"
      ? [{ id: "cash", label: "Caja", icon: Wallet }]
      : []),
    ...(actor.role === "ADMIN"
      ? [
          { id: "admin", label: "Resumen", icon: ChartNoAxesCombined },
          { id: "menu", label: "Menú", icon: ShoppingBag },
        ]
      : []),
  ];
  if (!data)
    return (
      <main className="max-w-xl mx-auto mt-24 card">
        <h1 className="text-xl font-bold">Preparando tu restaurante…</h1>
        {error && (
          <p role="alert" className="my-4 text-red-700">
            {error}
          </p>
        )}
        <button className="btn mt-4" onClick={refresh}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </main>
    );
  const active = data.tables.filter((t) => t.orderId),
    ready = data.tables.filter((t) => t.status === "READY");
  const selected = table ? data.tables.find((t) => t.id === table.id) : null;
  const payItems = pay
    ? data.items.filter((i) => i.order_id === pay.orderId)
    : [];
  const subtotal = payItems.reduce((n, i) => n + i.price * i.quantity, 0),
    tax = Math.round((subtotal * data.tax) / 100),
    tipAmount = tip ? Math.round(subtotal * 0.1) : 0,
    total = subtotal + tax + tipAmount;
  const shiftCash = data.totals?.find((t) => t.method === "CASH")?.total || 0;
  const modal = (title: string, body: React.ReactNode, close: () => void) => (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button className="btn secondary" aria-label="Cerrar" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {body}
      </section>
    </div>
  );
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-[#e0e5df] px-5 md:px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-800 text-white rounded-xl p-2">
            <UtensilsCrossed size={23} />
          </div>
          <span className="text-2xl font-bold tracking-tight">
            mesa<span className="text-green-600">.</span>
          </span>
          <span className="hidden md:block border-l ml-5 pl-5 text-xs muted tracking-widest">
            RESTAURANT OS
          </span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="hidden sm:inline text-xs text-green-700 bg-green-50 rounded-full px-3 py-2">
            ● Servicio activo
          </span>
          <div className="text-right text-sm">
            <p className="font-semibold">{actor.name}</p>
            <p className="text-xs muted">
              {actor.role === "ADMIN"
                ? "Administrador"
                : actor.role === "WAITER"
                  ? "Mesero"
                  : "Cajero"}
            </p>
          </div>
          <button
            aria-label="Cerrar sesión y cambiar de rol"
            className="btn secondary"
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <nav className="bg-white border-b flex px-5 md:px-10 gap-2 overflow-auto">
        {allowed.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`flex items-center gap-2 py-5 px-4 text-sm border-b-2 ${view === n.id ? "border-green-700 text-green-800 font-semibold" : "border-transparent muted"}`}
          >
            <n.icon size={17} />
            {n.label}
          </button>
        ))}
      </nav>
      <main className="max-w-7xl mx-auto p-5 md:p-10">
        {error && (
          <div
            role="alert"
            className="card text-red-700 mb-5 flex justify-between"
          >
            {error}
            <button onClick={refresh}>Reintentar</button>
          </div>
        )}
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="label mb-2">TU RESTAURANTE, EN TIEMPO REAL</p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {view === "tables"
                ? "Un servicio sin complicaciones."
                : view === "cash"
                  ? "Todo en orden. Hasta el último peso."
                  : view === "menu"
                    ? "Un menú para volver."
                    : "Una mirada a tu restaurante."}
            </h1>
            <p className="muted mt-3 text-sm">
              {view === "tables"
                ? "Selecciona una mesa para comenzar o continuar un pedido."
                : view === "cash"
                  ? "Gestiona los cobros y lleva el control de tu turno."
                  : view === "menu"
                    ? "Platos, precios y disponibilidad bajo tu control."
                    : "Las cifras de hoy para tomar mejores decisiones."}
            </p>
          </div>
          <button className="btn secondary hidden md:flex" onClick={refresh}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
        {view === "tables" && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                ["Mesas disponibles", data.tables.length - active.length],
                ["En servicio", active.length - ready.length],
                ["Por cobrar", ready.length],
              ].map(([label, n]) => (
                <div className="card" key={label}>
                  <p className="text-xs muted">{label}</p>
                  <p className="text-3xl font-semibold mt-3">
                    {n}
                    <span className="text-sm muted font-normal ml-2">
                      mesas
                    </span>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold">
                Salón principal{" "}
                <span className="muted font-normal text-sm">
                  {" "}
                  / {data.tables.length} mesas
                </span>
              </h2>
              <div className="flex gap-3 text-xs muted">
                <span>🟢 Libre</span>
                <span>🟠 Ocupada</span>
                <span>🔵 Por cobrar</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTable(t);
                    setCart([]);
                    setQuery("");
                    setCategory("Todos");
                  }}
                  className="card text-left hover:shadow-md transition-all min-h-44"
                >
                  <div className="flex justify-between">
                    <div
                      className={`p-3 rounded-xl ${t.status === "READY" ? "bg-blue-50 text-blue-600" : t.orderId ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}
                    >
                      <UtensilsCrossed size={22} />
                    </div>
                    <span
                      className={`text-xs rounded-full px-3 py-2 h-fit ${t.status === "READY" ? "bg-blue-50 text-blue-700" : t.orderId ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}
                    >
                      {t.status === "READY"
                        ? "Por cobrar"
                        : t.orderId
                          ? "Ocupada"
                          : "Libre"}
                    </span>
                  </div>
                  <p className="text-xl font-semibold mt-5">{t.name}</p>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="muted flex gap-1">
                      <Users size={15} /> 4 personas
                    </span>
                    <span>
                      {t.orderId ? money(t.subtotal) : "Iniciar pedido →"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="card mt-6 flex gap-4 items-center">
              <ChefHat className="text-green-700" />
              <div>
                <p className="font-semibold text-sm">
                  Del salón a la cocina, en un toque.
                </p>
                <p className="muted text-xs mt-1">
                  Las comandas quedan guardadas con cantidades y notas. El stock
                  se reserva al enviarlas.
                </p>
              </div>
            </div>
          </>
        )}
        {view === "cash" && (
          <>
            <div className="card mb-6 flex flex-wrap justify-between gap-4 items-center">
              <div>
                <p className="label">MI TURNO</p>
                <p className="text-xl font-semibold mt-2">
                  {data.shift ? "Caja abierta" : "Caja cerrada"}
                </p>
                <p className="muted text-sm mt-1">
                  {data.shift
                    ? `Base ${money(data.shift.initial)} · Efectivo esperado ${money(data.shift.initial + shiftCash)}`
                    : "Abre tu caja para comenzar a recibir pagos."}
                </p>
              </div>
              <button
                className="btn"
                onClick={() => setShiftModal(data.shift ? "close" : "open")}
              >
                <Wallet size={18} />
                {data.shift ? "Cerrar caja" : "Abrir caja"}
              </button>
            </div>
            <h2 className="font-semibold mb-4">
              Cuentas por cobrar <span className="muted">({ready.length})</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {ready.map((t) => (
                <div className="card" key={t.id}>
                  <div className="flex justify-between">
                    <h3 className="text-xl font-bold">{t.name}</h3>
                    <Receipt className="text-green-700" />
                  </div>
                  <p className="text-3xl mt-6 mb-4">{money(t.subtotal)}</p>
                  <p className="muted text-xs mb-5">
                    Subtotal · impuestos y propina al cobrar
                  </p>
                  <button
                    className="btn w-full"
                    disabled={!data.shift}
                    onClick={() => {
                      setPay(t);
                      setTip(false);
                      setMethod("CASH");
                      setTendered("");
                    }}
                  >
                    Cobrar cuenta <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </div>
            {!ready.length && (
              <div className="card text-center py-14 muted">
                <Check className="mx-auto mb-3" /> No hay cuentas pendientes.
                Todo al día.
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {["CASH", "CARD", "TRANSFER"].map((m) => (
                <div className="card" key={m}>
                  <p className="label">
                    {m === "CASH"
                      ? "Efectivo"
                      : m === "CARD"
                        ? "Tarjeta"
                        : "Transferencia"}
                  </p>
                  <p className="text-2xl mt-3">
                    {money(
                      data.totals?.find((t) => t.method === m)?.total || 0,
                    )}
                  </p>
                </div>
              ))}
            </div>
            <h2 className="font-semibold mt-8 mb-4">Mis cierres recientes</h2>
            <div className="card overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="muted">
                  <tr>
                    <th>Turno</th>
                    <th>Esperado en efectivo</th>
                    <th>Contado</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history
                    ?.filter((s) => s.closed_at)
                    .map((s) => (
                      <tr className="border-t border-gray-100" key={s.id}>
                        <td className="py-4">#{s.id}</td>
                        <td>{money(s.expected)}</td>
                        <td>{money(s.counted || 0)}</td>
                        <td>{money((s.counted || 0) - s.expected)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {view === "admin" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ["Ventas de hoy", money(data.kpi?.sales || 0), TrendingUp],
                ["Órdenes procesadas", data.kpi?.orders || 0, ShoppingBag],
                ["Ticket promedio", money(data.kpi?.average || 0), Receipt],
                [
                  "Gastos del día",
                  money(data.expenses?.reduce((n, e) => n + e.amount, 0) || 0),
                  Wallet,
                ],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Wallet;
                return (
                  <div className="card" key={String(label)}>
                    <div className="flex justify-between text-xs muted">
                      <span>{String(label)}</span>
                      <I size={18} />
                    </div>
                    <p className="text-2xl md:text-3xl font-semibold mt-5">
                      {String(value)}
                    </p>
                    <p className="text-xs muted mt-3">
                      Hoy · horario UTC del servidor
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="grid lg:grid-cols-3 gap-5 mt-6">
              <div className="card lg:col-span-2">
                <h2 className="font-semibold">Ritmo del día</h2>
                <p className="muted text-sm mt-1">Ventas por hora · COP</p>
                <div className="flex items-end gap-2 h-52 mt-8 border-b border-gray-200">
                  {Array.from({ length: 24 }, (_, h) => {
                    const value =
                        data.chart?.find((c) => Number(c.hour) === h)?.total ||
                        0,
                      max = Math.max(
                        ...(data.chart || []).map((c) => c.total),
                        1,
                      );
                    return (
                      <div
                        className="flex-1 flex flex-col justify-end items-center h-full"
                        key={h}
                      >
                        <div
                          title={`${h}:00 · ${money(value)}`}
                          className="w-full rounded-t bg-green-700 hover:bg-green-500 transition"
                          style={{
                            height: value
                              ? `${Math.max((value / max) * 85, 2)}%`
                              : "2px",
                          }}
                        />
                        <span className="text-[9px] muted mt-3 mb-2">
                          {h % 3 === 0 ? `${h}h` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card bg-[#153e2c] text-white">
                <p className="text-sm text-green-200">
                  Balance operativo de hoy
                </p>
                <p className="text-4xl mt-6">
                  {money(
                    (data.kpi?.sales || 0) -
                      (data.expenses?.reduce((n, e) => n + e.amount, 0) || 0),
                  )}
                </p>
                <p className="text-green-100/60 text-sm mt-4">
                  Ingresos cobrados menos gastos registrados. Incluye impuestos
                  y propinas; no representa utilidad neta.
                </p>
                <button
                  className="btn bg-white text-green-900 mt-8"
                  onClick={() => setExpense(true)}
                >
                  <Plus size={18} /> Registrar gasto
                </button>
              </div>
            </div>
            <div className="card mt-6">
              <div className="flex justify-between">
                <h2 className="font-semibold">Gastos operativos</h2>
                <button
                  className="text-green-700 text-sm"
                  onClick={() => setExpense(true)}
                >
                  + Agregar
                </button>
              </div>
              {data.expenses?.map((e) => (
                <div
                  className="flex justify-between py-4 border-b border-gray-100 text-sm"
                  key={e.id}
                >
                  <span>{e.description}</span>
                  <strong>{money(e.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="card mt-6 flex items-center gap-4">
              <Settings2 />
              <label className="text-sm">Impuesto sobre ventas (%)</label>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (await act({ action: "tax", tax: Number(f.get("tax")) }))
                    setToast("Impuesto actualizado");
                }}
              >
                <input
                  className="max-w-24"
                  name="tax"
                  type="number"
                  min="0"
                  max="30"
                  defaultValue={data.tax}
                  required
                />
                <button disabled={busy} className="btn secondary">
                  Guardar
                </button>
              </form>
            </div>
          </>
        )}
        {view === "menu" && (
          <>
            <div className="flex justify-between mb-5">
              <h2 className="font-semibold">
                Catálogo · {data.products.length} platos
              </h2>
              <button
                className="btn"
                onClick={() =>
                  setEdit({ category: "Entradas", active: 1, stock: 20 })
                }
              >
                <Plus size={18} /> Nuevo plato
              </button>
            </div>
            <div className="card overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="label">
                  <tr>
                    <th className="pb-4">Plato</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Porciones</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-5 font-semibold">{p.name}</td>
                      <td>{p.category}</td>
                      <td>{money(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>
                        <span className={p.active ? "text-green-700" : "muted"}>
                          {p.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="flex gap-2 py-3">
                        <button
                          aria-label={`Editar ${p.name}`}
                          className="btn secondary"
                          onClick={() => setEdit(p)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Eliminar ${p.name}`}
                          className="btn secondary"
                          onClick={async () => {
                            if (
                              window.confirm(
                                `¿Eliminar ${p.name}? Si tiene historial, deberás desactivarlo.`,
                              )
                            )
                              await act({ action: "delete", id: p.id });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <footer className="px-10 py-6 text-xs muted flex justify-between border-t border-gray-200">
        <span>mesa. · Un mejor servicio, todos los días.</span>
        <span>Datos guardados localmente · COP</span>
      </footer>
      {table &&
        modal(
          table.name,
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-3 text-gray-400"
                  size={20}
                />
                <input
                  aria-label="Buscar plato"
                  placeholder="Buscar un plato…"
                  style={{ paddingLeft: 40 }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-auto my-4">
                {categories.map((c) => (
                  <button
                    key={c}
                    className={`btn text-xs whitespace-nowrap ${category === c ? "" : "secondary"}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {data.products
                  .filter(
                    (p) =>
                      p.active &&
                      (category === "Todos" || p.category === category) &&
                      p.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <button
                      className="card text-left hover:border-green-700"
                      key={p.id}
                      disabled={
                        busy || selected?.status === "READY" || p.stock === 0
                      }
                      onClick={() =>
                        setCart((old) => {
                          const i = old.find((x) => x.productId === p.id);
                          if (i && i.quantity >= Math.min(p.stock, 50))
                            return old;
                          return i
                            ? old.map((x) =>
                                x.productId === p.id
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              )
                            : [
                                ...old,
                                { productId: p.id, quantity: 1, note: "" },
                              ];
                        })
                      }
                    >
                      <p className="label text-[10px]">{p.category}</p>
                      <p className="font-semibold mt-2">{p.name}</p>
                      <div className="flex justify-between mt-4 text-sm">
                        <span>{money(p.price)}</span>
                        <span className={p.stock ? "muted" : "text-red-600"}>
                          {p.stock} disp. <Plus className="inline" size={14} />
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
            <aside className="card">
              <h3 className="font-semibold mb-4">Cuenta de la mesa</h3>
              {data.items
                .filter((i) => i.order_id === selected?.orderId)
                .map((i) => (
                  <div
                    key={i.id}
                    className="text-sm border-b border-gray-100 py-3"
                  >
                    <div className="flex justify-between">
                      <span>
                        {i.quantity} × {i.name}
                      </span>
                      <span>{money(i.price * i.quantity)}</span>
                    </div>
                    {i.note && <p className="muted text-xs mt-1">{i.note}</p>}
                    <p className="text-xs text-green-700 mt-1">
                      Enviado a cocina
                    </p>
                  </div>
                ))}
              {cart.map((i) => {
                const p = data.products.find((p) => p.id === i.productId)!;
                return (
                  <div
                    key={i.productId}
                    className="border-b border-gray-100 py-3 text-sm"
                  >
                    <div className="flex justify-between">
                      <strong>{p.name}</strong>
                      <button
                        aria-label="Quitar plato"
                        onClick={() =>
                          setCart(
                            cart.filter((c) => c.productId !== i.productId),
                          )
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center my-2">
                      <input
                        aria-label="Cantidad"
                        type="number"
                        min="1"
                        max={Math.min(50, p.stock)}
                        value={i.quantity}
                        onChange={(e) =>
                          setCart(
                            cart.map((c) =>
                              c.productId === i.productId
                                ? { ...c, quantity: Number(e.target.value) }
                                : c,
                            ),
                          )
                        }
                      />
                      <span>{money(p.price * i.quantity)}</span>
                    </div>
                    <input
                      aria-label="Nota del plato"
                      placeholder="Sin cebolla, término medio…"
                      maxLength={200}
                      value={i.note}
                      onChange={(e) =>
                        setCart(
                          cart.map((c) =>
                            c.productId === i.productId
                              ? { ...c, note: e.target.value }
                              : c,
                          ),
                        )
                      }
                    />
                  </div>
                );
              })}
              <div className="flex justify-between font-bold my-5">
                <span>Subtotal</span>
                <span>
                  {money(
                    (selected?.subtotal || 0) +
                      cart.reduce(
                        (n, c) =>
                          n +
                          c.quantity *
                            (data.products.find((p) => p.id === c.productId)
                              ?.price || 0),
                        0,
                      ),
                  )}
                </span>
              </div>
              <button
                className="btn w-full"
                disabled={busy || !cart.length || selected?.status === "READY"}
                onClick={async () => {
                  const sent = await act({
                    action: "order",
                    tableId: table.id,
                    expectedOrderId: table.orderId,
                    items: cart,
                  });
                  if (sent) {
                    setTable({ ...table, orderId: sent.orderId });
                    setCart([]);
                    setToast("Comanda enviada a cocina y stock reservado");
                  }
                }}
              >
                <ChefHat size={18} /> Enviar a cocina
              </button>
              {selected?.orderId && selected.status === "OPEN" && (
                <button
                  className="btn secondary w-full mt-3"
                  disabled={busy || !!cart.length}
                  onClick={async () => {
                    if (
                      await act({ action: "ready", orderId: selected.orderId })
                    ) {
                      setTable(null);
                      setToast("Cuenta enviada a caja");
                    }
                  }}
                >
                  Solicitar cobro
                </button>
              )}
              {selected?.status === "READY" && (
                <p className="text-blue-700 text-sm mt-3">
                  Cuenta cerrada a nuevos pedidos. Pendiente de pago.
                </p>
              )}
              {actor.role === "ADMIN" && selected?.orderId && (
                <button
                  className="text-red-700 text-sm mt-5"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      window.confirm("¿Anular pedido y devolver el stock?") &&
                      (await act({
                        action: "cancel",
                        orderId: selected.orderId,
                      }))
                    ) {
                      setTable(null);
                      setToast("Pedido anulado");
                    }
                  }}
                >
                  Anular pedido
                </button>
              )}
            </aside>
          </div>,
          () => setTable(null),
        )}
      {pay &&
        modal(
          `Cobrar · ${pay.name}`,
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              {payItems.map((i) => (
                <div className="flex justify-between py-3 text-sm" key={i.id}>
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  <span>{money(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="border-t mt-4 pt-4 space-y-3 text-sm">
                <p className="flex justify-between">
                  Subtotal<span>{money(subtotal)}</span>
                </p>
                <p className="flex justify-between">
                  Impuesto ({data.tax}%)<span>{money(tax)}</span>
                </p>
                <p className="flex justify-between">
                  Propina voluntaria<span>{money(tipAmount)}</span>
                </p>
                <p className="flex justify-between font-bold text-2xl pt-4">
                  Total<span>{money(total)}</span>
                </p>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-3 my-4">
                <input
                  className="!w-5"
                  type="checkbox"
                  checked={tip}
                  onChange={(e) => setTip(e.target.checked)}
                />{" "}
                Incluir propina voluntaria del 10%
              </label>
              <label className="text-sm">Método de pago</label>
              <select
                className="mt-2 mb-5"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
              </select>
              {method === "CASH" && (
                <>
                  <label className="text-sm">Efectivo recibido (COP)</label>
                  <input
                    type="number"
                    min={total}
                    step="1"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                  <p className="my-4 text-lg">
                    Cambio:{" "}
                    <strong>
                      {money(Math.max(0, Number(tendered) - total))}
                    </strong>
                  </p>
                </>
              )}
              <p className="text-xs muted my-5">
                Confirma el dinero recibido o la aprobación del pago antes de
                finalizar. Tarjeta y transferencia se registran manualmente.
              </p>
              <button
                className="btn w-full"
                disabled={
                  busy || (method === "CASH" && Number(tendered) < total)
                }
                onClick={async () => {
                  const payment = await act({
                    action: "pay",
                    orderId: pay.orderId,
                    method,
                    tip,
                    tendered: method === "CASH" ? Number(tendered) : total,
                  });
                  if (payment) {
                    setReceipt({ payment, items: payItems });
                    setPay(null);
                  }
                }}
              >
                <Check size={18} /> Confirmar cobro
              </button>
            </div>
          </div>,
          () => setPay(null),
        )}
      {receipt &&
        modal(
          "Recibo de caja",
          <>
            <div className="receipt">
              <h2 className="text-center text-3xl font-bold">mesa.</h2>
              <p className="text-center text-xs my-3">
                RECIBO DE CAJA · #{receipt.payment.id}
                <br />
                Pedido #{receipt.payment.order_id}
                <br />
                No constituye factura fiscal
              </p>
              <hr />
              {receipt.items.map((i) => (
                <div key={i.id} className="flex justify-between text-sm my-3">
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  <span>{money(i.price * i.quantity)}</span>
                </div>
              ))}
              <hr />
              <div className="text-sm space-y-2 my-4">
                {[
                  ["Subtotal", receipt.payment.subtotal],
                  ["Impuesto", receipt.payment.tax],
                  ["Propina", receipt.payment.tip],
                  ["TOTAL", receipt.payment.total],
                  ["Recibido", receipt.payment.tendered],
                  ["Cambio", receipt.payment.tendered - receipt.payment.total],
                ].map(([l, v]) => (
                  <p key={l} className="flex justify-between">
                    <span>{l}</span>
                    <strong>{money(Number(v))}</strong>
                  </p>
                ))}
              </div>
              <p className="text-center text-xs">
                {receipt.payment.method}
                <br />
                ¡Gracias por compartir nuestra mesa!
              </p>
            </div>
            <button
              className="btn mx-auto mt-5 no-print"
              onClick={() => window.print()}
            >
              <Printer size={18} /> Imprimir recibo
            </button>
          </>,
          () => setReceipt(null),
        )}
      {edit &&
        modal(
          edit.id ? "Editar plato" : "Nuevo plato",
          <form
            className="max-w-lg mx-auto space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act({
                  action: "product",
                  id: edit.id,
                  name: f.get("name"),
                  category: f.get("category"),
                  price: Number(f.get("price")),
                  stock: Number(f.get("stock")),
                  active: f.get("active") === "on",
                })
              ) {
                setEdit(null);
                setToast("Menú actualizado");
              }
            }}
          >
            <label className="block">
              Nombre
              <input
                name="name"
                maxLength={100}
                required
                defaultValue={edit.name}
              />
            </label>
            <label className="block">
              Categoría
              <select name="category" defaultValue={edit.category}>
                {categories.slice(1).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Precio (COP)
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={edit.price}
              />
            </label>
            <label className="block">
              Porciones e ingrediente preparado disponible
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={edit.stock}
              />
            </label>
            <label className="flex gap-3">
              <input
                className="!w-5"
                type="checkbox"
                name="active"
                defaultChecked={!!edit.active}
              />{" "}
              Plato activo
            </label>
            <button className="btn w-full" disabled={busy}>
              Guardar plato
            </button>
          </form>,
          () => setEdit(null),
        )}
      {expense &&
        modal(
          "Registrar gasto",
          <form
            className="max-w-lg mx-auto space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act({
                  action: "expense",
                  description: f.get("description"),
                  amount: Number(f.get("amount")),
                })
              ) {
                setExpense(false);
                setToast("Gasto registrado");
              }
            }}
          >
            <label className="block">
              Concepto
              <input name="description" maxLength={100} required />
            </label>
            <label className="block">
              Monto (COP)
              <input name="amount" type="number" min="1" step="1" required />
            </label>
            <button className="btn" disabled={busy}>
              Registrar gasto
            </button>
          </form>,
          () => setExpense(false),
        )}
      {shiftModal &&
        modal(
          shiftModal === "open" ? "Abrir mi caja" : "Cerrar mi caja",
          <form
            className="max-w-lg mx-auto"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act(
                  shiftModal === "open"
                    ? { action: "open", initial: Number(f.get("amount")) }
                    : { action: "close", counted: Number(f.get("amount")) },
                )
              ) {
                setShiftModal(null);
                setToast("Turno actualizado");
              }
            }}
          >
            {shiftModal === "close" && (
              <p className="mb-5">
                Efectivo esperado:{" "}
                <strong>{money((data.shift?.initial || 0) + shiftCash)}</strong>
                . El cierre guardará el monto contado y la diferencia.
              </p>
            )}
            <label>
              {shiftModal === "open"
                ? "Base inicial (COP)"
                : "Efectivo contado (COP)"}
              <input name="amount" type="number" min="0" step="1" required />
            </label>
            <button className="btn mt-5" disabled={busy}>
              Confirmar {shiftModal === "open" ? "apertura" : "cierre"}
            </button>
          </form>,
          () => setShiftModal(null),
        )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

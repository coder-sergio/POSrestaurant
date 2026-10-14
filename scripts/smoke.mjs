import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://localhost:3000";
const password = process.env.SEED_PASSWORD;
if (!password)
  throw Error("Ejecuta con --env-file=.env.local o define SEED_PASSWORD");
async function request(path, cookie, body) {
  const r = await fetch(base + path, {
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json", origin: base } : {}),
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return r;
}
assert.equal((await request("/api/pos")).status, 401);
assert.equal((await request("/")).status, 307);
const session = async (email) => {
  const r = await request("/api/login", null, { email, password });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  return cookie.split(";")[0];
};
const waiter = await session("mesero@mesa.local"),
  cashier = await session("caja@mesa.local"),
  admin = await session("admin@mesa.local");
const read = async (cookie) => {
  const r = await request("/api/pos", cookie);
  assert.equal(r.status, 200);
  return r.json();
};
const w = await read(waiter);
assert.equal("kpi" in w, false);
assert.equal("shift" in w, false);
assert.equal(
  (await request("/api/pos", waiter, { action: "tax", tax: 10 })).status,
  403,
);
assert.equal(
  (
    await request("/api/pos", cashier, {
      action: "expense",
      description: "No autorizado",
      amount: 1,
    })
  ).status,
  403,
);
assert.equal(
  (
    await fetch(base + "/api/pos", {
      method: "POST",
      headers: {
        cookie: admin,
        "Content-Type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ action: "tax", tax: 9 }),
    })
  ).status,
  403,
);
assert.equal((await request("/", waiter)).status, 200);
assert.equal((await read(admin)).kpi.orders >= 1, true);
const free = w.tables.find((t) => !t.orderId);
assert.ok(free);
const send = async (cookie, body) => {
  const r = await request("/api/pos", cookie, body);
  assert.equal(r.status, 200);
  return r.json();
};
const ordered = await send(waiter, {
  action: "order",
  tableId: free.id,
  expectedOrderId: null,
  items: [{ productId: 1, quantity: 1, note: "Prueba de integración" }],
});
await send(waiter, { action: "ready", orderId: ordered.orderId });
const cash = await read(cashier),
  opened = !cash.shift;
if (opened) await send(cashier, { action: "open", initial: 0 });
const payment = await send(cashier, {
  action: "pay",
  orderId: ordered.orderId,
  method: "CASH",
  tip: false,
  tendered: 50000,
});
assert.equal(payment.total, Math.round(18000 * (1 + w.tax / 100)));
assert.equal(
  (
    await request("/api/pos", cashier, {
      action: "pay",
      orderId: ordered.orderId,
      method: "CASH",
      tip: false,
      tendered: 50000,
    })
  ).status,
  400,
);
assert.equal(
  (await read(waiter)).tables.find((t) => t.id === free.id).orderId,
  null,
);
if (opened) await send(cashier, { action: "close", counted: payment.total });
assert.equal((await request("/api/logout", waiter, {})).status, 200);
assert.equal((await request("/api/pos", waiter)).status, 401);
await request("/api/logout", cashier, {});
await request("/api/logout", admin, {});
console.log(
  "HTTP smoke OK: login, cookies, SSR, RBAC, datos filtrados, CSRF revocación, pedido, cobro y cierre de caja.",
);

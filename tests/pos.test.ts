import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.POS_DATA_DIR = mkdtempSync(join(tmpdir(), "mesa-test-"));
process.env.SEED_PASSWORD = "TestOnly-Password-2026";
const { db, seed } = await import("../lib/db.ts");
const { execute, snapshot, permissions } = await import("../lib/pos.ts");
seed();
const waiter = { id: 3, role: "WAITER" as const },
  cashier = { id: 2, role: "CASHIER" as const },
  admin = { id: 1, role: "ADMIN" as const };
test("RBAC rejects all unauthorized commands and hides financial data", () => {
  const inputs: Record<string, unknown> = {
    order: {
      expectedOrderId: null,
      tableId: 2,
      items: [{ productId: 1, quantity: 1, note: "" }],
    },
    ready: { orderId: 2 },
    pay: { orderId: 2, method: "CASH", tip: false, tendered: 999999 },
    open: { initial: 0 },
    close: { counted: 0 },
    product: {
      name: "Test",
      category: "Entradas",
      price: 1,
      stock: 1,
      active: true,
    },
    delete: { id: 1 },
    expense: { description: "Test", amount: 1 },
    tax: { tax: 10 },
    cancel: { orderId: 2 },
  };
  for (const actor of [waiter, cashier])
    for (const [action, fields] of Object.entries(inputs))
      if (!permissions[action].includes(actor.role))
        assert.throws(
          () => execute(actor, { action, ...(fields as object) }),
          /permiso/,
        );
  assert.equal("kpi" in snapshot(waiter), false);
  assert.equal("shift" in snapshot(waiter), false);
  assert.equal("kpi" in snapshot(cashier), false);
});
test("stock failures roll back entire order including previous line", () => {
  const before = db.prepare("SELECT stock FROM products WHERE id=1").get();
  assert.throws(
    () =>
      execute(waiter, {
        action: "order",
        expectedOrderId: null,
        tableId: 2,
        items: [
          { productId: 1, quantity: 2, note: "" },
          { productId: 3, quantity: 50, note: "" },
        ],
      }),
    /Stock/,
  );
  assert.deepEqual(
    db.prepare("SELECT stock FROM products WHERE id=1").get(),
    before,
  );
  assert.equal(
    db.prepare("SELECT id FROM orders WHERE table_id=2").get(),
    undefined,
  );
});
test("payment is atomic, prevents double charging, rejects closed tables", () => {
  execute(cashier, { action: "open", initial: 100000 });
  const order = execute(waiter, {
    action: "order",
    expectedOrderId: null,
    tableId: 2,
    items: [{ productId: 1, quantity: 2, note: "Sin sal" }],
  }) as { orderId: number };
  execute(waiter, { action: "ready", orderId: order.orderId });
  assert.throws(
    () =>
      execute(waiter, {
        action: "order",
        expectedOrderId: order.orderId,
        tableId: 2,
        items: [{ productId: 1, quantity: 1, note: "" }],
      }),
    /cobrar/,
  );
  assert.throws(
    () =>
      execute(cashier, {
        action: "pay",
        orderId: order.orderId,
        method: "CASH",
        tip: true,
        tendered: 1,
      }),
    /insuficiente/,
  );
  assert.equal(
    db.prepare("SELECT id FROM payments WHERE order_id=?").get(order.orderId),
    undefined,
  );
  const p = execute(cashier, {
    action: "pay",
    orderId: order.orderId,
    method: "CASH",
    tip: true,
    tendered: 50000,
  }) as { total: number };
  assert.equal(p.total, 42480);
  assert.throws(
    () =>
      execute(cashier, {
        action: "pay",
        orderId: order.orderId,
        method: "CASH",
        tip: true,
        tendered: 50000,
      }),
    /pagada/,
  );
  execute(cashier, { action: "close", counted: 142480 });
});
test("cancel restores ingredient and product stock, rejects paid orders", () => {
  const stock = (
    db.prepare("SELECT stock FROM products WHERE id=1").get() as {
      stock: number;
    }
  ).stock;
  const o = execute(waiter, {
    action: "order",
    expectedOrderId: null,
    tableId: 4,
    items: [{ productId: 1, quantity: 1, note: "" }],
  }) as { orderId: number };
  execute(admin, { action: "cancel", orderId: o.orderId });
  assert.equal(
    (
      db.prepare("SELECT stock FROM products WHERE id=1").get() as {
        stock: number;
      }
    ).stock,
    stock,
  );
  assert.equal(
    (
      db.prepare("SELECT stock FROM ingredients WHERE id=1").get() as {
        stock: number;
      }
    ).stock,
    stock,
  );
  assert.throws(() => execute(admin, { action: "cancel", orderId: 1 }), /Solo/);
});
test("strict validation rejects malicious or malformed input", () => {
  assert.throws(() =>
    execute(admin, {
      action: "expense",
      description: "<script>alert(1)</script>",
      amount: 1,
    }),
  );
  assert.throws(() =>
    execute(waiter, {
      action: "order",
      expectedOrderId: null,
      tableId: 1,
      items: [{ productId: 1, quantity: -1, note: "" }],
    }),
  );
  assert.throws(() =>
    execute(admin, {
      action: "product",
      name: "A",
      category: "Entradas",
      price: 1.5,
      stock: 1,
      active: true,
    }),
  );
});

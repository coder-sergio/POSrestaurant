import { db, transaction, type Role } from "./db.ts";
import { command } from "./schema.ts";
export const permissions: Record<string, Role[]> = {
  order: ["WAITER", "ADMIN"],
  ready: ["WAITER", "ADMIN"],
  pay: ["CASHIER", "ADMIN"],
  open: ["CASHIER", "ADMIN"],
  close: ["CASHIER", "ADMIN"],
  product: ["ADMIN"],
  delete: ["ADMIN"],
  expense: ["ADMIN"],
  tax: ["ADMIN"],
  cancel: ["ADMIN"],
};
export function execute(actor: { id: number; role: Role }, input: unknown) {
  const c = command.parse(input);
  if (!permissions[c.action].includes(actor.role))
    throw new Error("No tienes permiso para esta operación");
  return transaction(() => {
    let result: unknown = { ok: true };
    if (c.action === "order") {
      if (!db.prepare("SELECT id FROM tables WHERE id=?").get(c.tableId))
        throw new Error("Mesa inexistente");
      let order = db
        .prepare(
          "SELECT id,status FROM orders WHERE table_id=? AND status IN ('OPEN','READY')",
        )
        .get(c.tableId) as { id: number; status: string } | undefined;
      if ((order?.id || null) !== c.expectedOrderId)
        throw new Error(
          "La mesa cambió de estado. Actualiza y revisa el pedido",
        );
      if (order?.status === "READY")
        throw new Error("La mesa ya está por cobrar");
      if (!order)
        order = {
          id: Number(
            db.prepare("INSERT INTO orders(table_id) VALUES(?)").run(c.tableId)
              .lastInsertRowid,
          ),
          status: "OPEN",
        };
      for (const item of c.items) {
        const p = db
          .prepare("SELECT * FROM products WHERE id=? AND active=1")
          .get(item.productId) as
          | { id: number; name: string; price: number; stock: number }
          | undefined;
        if (!p || p.stock < item.quantity)
          throw new Error("Stock insuficiente o plato desactivado");
        const ingredients = db
          .prepare(
            "SELECT r.ingredient_id,r.quantity,i.stock FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.product_id=?",
          )
          .all(p.id) as {
          ingredient_id: number;
          quantity: number;
          stock: number;
        }[];
        for (const i of ingredients) {
          if (i.stock < i.quantity * item.quantity)
            throw new Error("Ingredientes insuficientes");
          db.prepare("UPDATE ingredients SET stock=stock-? WHERE id=?").run(
            i.quantity * item.quantity,
            i.ingredient_id,
          );
        }
        db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(
          item.quantity,
          p.id,
        );
        db.prepare(
          "INSERT INTO items(order_id,product_id,name,price,quantity,note) VALUES(?,?,?,?,?,?)",
        ).run(order.id, p.id, p.name, p.price, item.quantity, item.note);
      }
      result = { ok: true, orderId: order.id };
    }
    if (c.action === "ready") {
      if (
        !db
          .prepare(
            "UPDATE orders SET status='READY' WHERE id=? AND status='OPEN'",
          )
          .run(c.orderId).changes
      )
        throw new Error("La mesa no está abierta");
    }
    if (c.action === "pay") {
      const shift = db
        .prepare("SELECT id FROM shifts WHERE user_id=? AND closed_at IS NULL")
        .get(actor.id) as { id: number } | undefined;
      if (!shift) throw new Error("Abre tu caja antes de cobrar");
      const order = db
        .prepare("SELECT id FROM orders WHERE id=? AND status='READY'")
        .get(c.orderId);
      if (!order)
        throw new Error("La cuenta no está por cobrar o ya fue pagada");
      const subtotal = Number(
        (
          db
            .prepare("SELECT SUM(price*quantity) n FROM items WHERE order_id=?")
            .get(c.orderId) as { n: number }
        ).n,
      );
      const rate = (
        db.prepare("SELECT tax FROM settings WHERE id=1").get() as {
          tax: number;
        }
      ).tax;
      const tax = Math.round((subtotal * rate) / 100),
        tip = c.tip ? Math.round(subtotal * 0.1) : 0,
        total = subtotal + tax + tip;
      if (c.method === "CASH" && c.tendered < total)
        throw new Error("Efectivo insuficiente");
      const payment = db
        .prepare(
          "INSERT INTO payments(order_id,shift_id,subtotal,tax,tip,total,method,tendered) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          c.orderId,
          shift.id,
          subtotal,
          tax,
          tip,
          total,
          c.method,
          c.method === "CASH" ? c.tendered : total,
        );
      db.prepare("UPDATE orders SET status='PAID' WHERE id=?").run(c.orderId);
      result = db
        .prepare("SELECT * FROM payments WHERE id=?")
        .get(payment.lastInsertRowid);
    }
    if (c.action === "open")
      db.prepare("INSERT INTO shifts(user_id,initial) VALUES(?,?)").run(
        actor.id,
        c.initial,
      );
    if (c.action === "close") {
      if (
        !db
          .prepare(
            "UPDATE shifts SET closed_at=CURRENT_TIMESTAMP,counted=? WHERE user_id=? AND closed_at IS NULL",
          )
          .run(c.counted, actor.id).changes
      )
        throw new Error("No hay una caja abierta");
    }
    if (c.action === "product") {
      if (c.id) {
        if (
          !db
            .prepare(
              "UPDATE products SET name=?,category=?,price=?,stock=?,active=? WHERE id=?",
            )
            .run(c.name, c.category, c.price, c.stock, Number(c.active), c.id)
            .changes
        )
          throw new Error("Plato inexistente");
        db.prepare(
          "UPDATE ingredients SET stock=? WHERE id IN (SELECT ingredient_id FROM recipes WHERE product_id=?)",
        ).run(c.stock, c.id);
      } else {
        const p = db
          .prepare(
            "INSERT INTO products(name,category,price,stock,active) VALUES(?,?,?,?,?)",
          )
          .run(c.name, c.category, c.price, c.stock, Number(c.active));
        const i = db
          .prepare("INSERT INTO ingredients(name,stock) VALUES(?,?)")
          .run(`Porción preparada: ${c.name}`, c.stock);
        db.prepare("INSERT INTO recipes VALUES(?,?,1)").run(
          p.lastInsertRowid,
          i.lastInsertRowid,
        );
      }
    }
    if (c.action === "delete") {
      if (db.prepare("SELECT id FROM items WHERE product_id=?").get(c.id))
        throw new Error(
          "El plato tiene historial: desactívalo para conservarlo",
        );
      db.prepare("DELETE FROM recipes WHERE product_id=?").run(c.id);
      db.prepare("DELETE FROM products WHERE id=?").run(c.id);
    }
    if (c.action === "expense")
      db.prepare("INSERT INTO expenses(description,amount) VALUES(?,?)").run(
        c.description,
        c.amount,
      );
    if (c.action === "tax")
      db.prepare("UPDATE settings SET tax=? WHERE id=1").run(c.tax);
    if (c.action === "cancel") {
      if (
        !db
          .prepare(
            "SELECT id FROM orders WHERE id=? AND status IN ('OPEN','READY')",
          )
          .get(c.orderId)
      )
        throw new Error("Solo se pueden anular pedidos sin cobrar");
      const items = db
        .prepare("SELECT product_id,quantity FROM items WHERE order_id=?")
        .all(c.orderId) as { product_id: number; quantity: number }[];
      for (const i of items) {
        db.prepare("UPDATE products SET stock=stock+? WHERE id=?").run(
          i.quantity,
          i.product_id,
        );
        db.prepare(
          "UPDATE ingredients SET stock=stock+?*(SELECT quantity FROM recipes WHERE product_id=? AND ingredient_id=ingredients.id) WHERE id IN (SELECT ingredient_id FROM recipes WHERE product_id=?)",
        ).run(i.quantity, i.product_id, i.product_id);
      }
      db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").run(
        c.orderId,
      );
    }
    db.prepare("INSERT INTO audit(user_id,action) VALUES(?,?)").run(
      actor.id,
      c.action,
    );
    return result;
  });
}
export function snapshot(actor: { id: number; role: Role }) {
  const products = db
    .prepare(
      actor.role === "ADMIN"
        ? "SELECT * FROM products"
        : "SELECT * FROM products WHERE active=1",
    )
    .all();
  const tables = db
    .prepare(
      "SELECT t.*,o.id orderId,o.status,COALESCE((SELECT SUM(price*quantity) FROM items WHERE order_id=o.id),0) subtotal FROM tables t LEFT JOIN orders o ON o.table_id=t.id AND o.status IN ('OPEN','READY')",
    )
    .all();
  const items = db
    .prepare(
      "SELECT i.* FROM items i JOIN orders o ON i.order_id=o.id WHERE o.status IN ('OPEN','READY')",
    )
    .all();
  const base = {
    products,
    tables,
    items,
    tax: (
      db.prepare("SELECT tax FROM settings WHERE id=1").get() as { tax: number }
    ).tax,
  };
  if (actor.role === "WAITER") return base;
  const shift =
    db
      .prepare("SELECT * FROM shifts WHERE user_id=? AND closed_at IS NULL")
      .get(actor.id) || null;
  const totals = db
    .prepare(
      "SELECT p.method,SUM(p.total) total,COUNT(*) count FROM payments p JOIN shifts s ON s.id=p.shift_id WHERE s.user_id=? AND s.closed_at IS NULL GROUP BY p.method",
    )
    .all(actor.id);
  const history = db
    .prepare(
      "SELECT s.*,COALESCE((SELECT SUM(total) FROM payments WHERE shift_id=s.id AND method='CASH'),0)+s.initial expected FROM shifts s WHERE user_id=? ORDER BY id DESC LIMIT 10",
    )
    .all(actor.id);
  if (actor.role === "CASHIER") return { ...base, shift, totals, history };
  const kpi = db
    .prepare(
      "SELECT COALESCE(SUM(total),0) sales,COUNT(*) orders,COALESCE(ROUND(AVG(total)),0) average FROM payments WHERE date(created_at)=date('now')",
    )
    .get();
  const expenses = db
    .prepare(
      "SELECT * FROM expenses WHERE date(created_at)=date('now') ORDER BY id DESC",
    )
    .all();
  const chart = db
    .prepare(
      "SELECT strftime('%H',created_at) hour,SUM(total) total FROM payments WHERE date(created_at)=date('now') GROUP BY hour",
    )
    .all();
  return { ...base, shift, totals, history, kpi, expenses, chart };
}

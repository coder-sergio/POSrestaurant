import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { hashSync } from "bcryptjs";
export type Role = "WAITER" | "CASHIER" | "ADMIN";
const directory = process.env.POS_DATA_DIR || join(process.cwd(), "data");
mkdirSync(directory, { recursive: true });
export const db = new DatabaseSync(join(directory, "pos.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tables(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0), stock INTEGER NOT NULL CHECK(stock>=0), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS ingredients(id INTEGER PRIMARY KEY, name TEXT NOT NULL, stock INTEGER NOT NULL CHECK(stock>=0));
CREATE TABLE IF NOT EXISTS recipes(product_id INTEGER REFERENCES products(id), ingredient_id INTEGER REFERENCES ingredients(id), quantity INTEGER NOT NULL CHECK(quantity>0), PRIMARY KEY(product_id,ingredient_id));
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, table_id INTEGER NOT NULL REFERENCES tables(id), status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_table ON orders(table_id) WHERE status IN ('OPEN','READY');
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), note TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS shifts(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),initial INTEGER NOT NULL, opened_at TEXT DEFAULT CURRENT_TIMESTAMP,closed_at TEXT,counted INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS one_shift ON shifts(user_id) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,order_id INTEGER UNIQUE REFERENCES orders(id),shift_id INTEGER REFERENCES shifts(id),subtotal INTEGER NOT NULL,tax INTEGER NOT NULL,tip INTEGER NOT NULL,total INTEGER NOT NULL,method TEXT NOT NULL,tendered INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY,description TEXT NOT NULL,amount INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),tax INTEGER NOT NULL DEFAULT 8);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO settings(id,tax) VALUES(1,8);`);
export function transaction<T>(run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = run();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function seed() {
  if ((db.prepare("SELECT count(*) n FROM users").get() as { n: number }).n)
    return;
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Define SEED_PASSWORD (mínimo 12 caracteres) para crear las cuentas iniciales.",
    );
  transaction(() => {
    for (const [name, email, role] of [
      ["Sergio", "admin@mesa.local", "ADMIN"],
      ["Laura", "caja@mesa.local", "CASHIER"],
      ["Daniel", "mesero@mesa.local", "WAITER"],
    ])
      db.prepare(
        "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
      ).run(name, email, hashSync(password, 12), role);
    for (let i = 1; i <= 12; i++)
      db.prepare("INSERT INTO tables(name) VALUES(?)").run(
        `Mesa ${String(i).padStart(2, "0")}`,
      );
    const products = [
      ["Croquetas de la casa", "Entradas", 18000, 40],
      ["Burrata & tomates", "Entradas", 26000, 24],
      ["Salmón a la plancha", "Platos Fuertes", 48000, 20],
      ["Hamburguesa artesanal", "Platos Fuertes", 32000, 35],
      ["Risotto de hongos", "Platos Fuertes", 36000, 25],
      ["Limonada natural", "Bebidas", 9000, 60],
      ["Café de origen", "Bebidas", 6500, 80],
      ["Tarta de chocolate", "Postres", 14000, 30],
    ];
    for (const p of products) {
      const result = db
        .prepare(
          "INSERT INTO products(name,category,price,stock) VALUES(?,?,?,?)",
        )
        .run(...p);
      const ingredient = db
        .prepare("INSERT INTO ingredients(name,stock) VALUES(?,?)")
        .run(`Porción preparada: ${p[0]}`, p[3]);
      db.prepare("INSERT INTO recipes VALUES(?,?,1)").run(
        result.lastInsertRowid,
        ingredient.lastInsertRowid,
      );
    }
    db.prepare(
      "INSERT INTO shifts(user_id,initial,closed_at,counted) VALUES(2,100000,CURRENT_TIMESTAMP,134560)",
    ).run();
    db.prepare("INSERT INTO orders(table_id,status) VALUES(1,'PAID')").run();
    db.prepare(
      "INSERT INTO items(order_id,product_id,name,price,quantity) VALUES(1,4,'Hamburguesuesa artesanal',32000,1)",
    ).run();
    db.prepare(
      "INSERT INTO payments(order_id,shift_id,subtotal,tax,tip,total,method,tendered) VALUES(1,1,32000,2560,0,34560,'CASH',40000)",
    ).run();
    db.prepare(
      "INSERT INTO expenses(description,amount) VALUES('Insumos de apertura',18000)",
    ).run();
    db.prepare("INSERT INTO orders(table_id) VALUES(3)").run();
    db.prepare(
      "INSERT INTO items(order_id,product_id,name,price,quantity,note) VALUES(2,3,'Salmón a la plancha',48000,2,'Sin sal')",
    ).run();
    db.prepare("UPDATE products SET stock=stock-2 WHERE id=3").run();
    db.prepare("UPDATE ingredients SET stock=stock-2 WHERE id=3").run();
  });
}

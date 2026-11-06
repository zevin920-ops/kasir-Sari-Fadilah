import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let connection: SQLiteDBConnection | null = null;
let webMode = false;
const WEB_KEY = "ruangkasir_local_db_v1";

type LocalData = { products: Product[]; sales: Sale[] };
export type Product = { id: string; name: string; sku: string; category: string; price: number; stock: number };
export type SaleItem = { productId: string; name: string; price: number; quantity: number; lineTotal: number };
export type Sale = { id: string; invoice: string; subtotal: number; discount: number; total: number; paid: number; change: number; createdAt: string; items: SaleItem[] };

const seedProducts: Product[] = [
  { id: "p1", name: "Kopi Susu Gula Aren", sku: "KPG-001", category: "Minuman", price: 18000, stock: 24 },
  { id: "p2", name: "Americano", sku: "AMR-002", category: "Minuman", price: 15000, stock: 18 },
  { id: "p3", name: "Matcha Latte", sku: "MTC-003", category: "Minuman", price: 22000, stock: 12 },
  { id: "p4", name: "Croissant Butter", sku: "CRS-004", category: "Makanan", price: 16000, stock: 15 },
  { id: "p5", name: "Roti Cokelat", sku: "RTC-005", category: "Makanan", price: 12000, stock: 20 },
  { id: "p6", name: "Air Mineral", sku: "AIR-006", category: "Minuman", price: 6000, stock: 40 }
];

function readWeb(): LocalData {
  try {
    const raw = localStorage.getItem(WEB_KEY);
    return raw ? JSON.parse(raw) as LocalData : { products: seedProducts, sales: [] };
  } catch { return { products: seedProducts, sales: [] }; }
}
function writeWeb(data: LocalData) { localStorage.setItem(WEB_KEY, JSON.stringify(data)); }

export async function initDB() {
  if (Capacitor.getPlatform() === "web") {
    webMode = true;
    if (!localStorage.getItem(WEB_KEY)) writeWeb({ products: seedProducts, sales: [] });
    return;
  }
  connection = await sqlite.createConnection("ruangkasir", false, "no-encryption", 1, false);
  await connection.open();
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, sku TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'Umum', price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL, invoice TEXT NOT NULL UNIQUE, subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL, total INTEGER NOT NULL, paid INTEGER NOT NULL,
      change_amount INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL, sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
      name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL, line_total INTEGER NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id), FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
  const existing = await connection.query("SELECT COUNT(*) AS count FROM products");
  if (Number(existing.values?.[0]?.count ?? 0) === 0) {
    for (const p of seedProducts) await connection.run(
      "INSERT INTO products (id,name,sku,category,price,stock) VALUES (?,?,?,?,?,?)",
      [p.id,p.name,p.sku,p.category,p.price,p.stock]
    );
  }
}

export async function getProducts(): Promise<Product[]> {
  if (webMode) return readWeb().products;
  const r = await connection!.query("SELECT * FROM products ORDER BY name");
  return (r.values ?? []) as Product[];
}
export async function saveProduct(p: Omit<Product, "id">) {
  if (webMode) {
    const d = readWeb();
    if (d.products.some(x => x.sku.toLowerCase() === p.sku.toLowerCase())) throw new Error("Kode SKU sudah digunakan.");
    d.products.push({ ...p, id: crypto.randomUUID() }); writeWeb(d); return;
  }
  await connection!.run("INSERT INTO products (id,name,sku,category,price,stock) VALUES (?,?,?,?,?,?)",
    [crypto.randomUUID(),p.name,p.sku,p.category,p.price,p.stock]);
}
export async function updateStock(id: string, stock: number) {
  if (webMode) { const d=readWeb(); d.products=d.products.map(p=>p.id===id?{...p,stock}:p); writeWeb(d); return; }
  await connection!.run("UPDATE products SET stock=? WHERE id=?", [stock,id]);
}
export async function saveSale(input: { items: { productId: string; quantity: number }[]; discount: number; paid: number }): Promise<Sale> {
  const products = await getProducts();
  const items: SaleItem[] = input.items.map(i => {
    const p = products.find(x => x.id === i.productId);
    if (!p || i.quantity < 1 || p.stock < i.quantity) throw new Error(`Stok ${p?.name ?? "produk"} tidak mencukupi.`);
    return { productId: p.id, name: p.name, price: p.price, quantity: i.quantity, lineTotal: p.price * i.quantity };
  });
  const subtotal = items.reduce((n,i)=>n+i.lineTotal,0);
  const discount = Math.max(0,Math.min(subtotal,Math.floor(input.discount)));
  const total = subtotal - discount;
  if (!Number.isFinite(input.paid) || input.paid < total) throw new Error("Uang diterima belum mencukupi.");
  const sale: Sale = {
    id: crypto.randomUUID(), invoice: `INV-${Date.now().toString().slice(-8)}`,
    subtotal, discount, total, paid: input.paid, change: input.paid-total,
    createdAt: new Date().toISOString(), items
  };
  if (webMode) {
    const d=readWeb();
    d.products=d.products.map(p=>({...p,stock:p.stock-(items.find(i=>i.productId===p.id)?.quantity??0)}));
    d.sales.unshift(sale); writeWeb(d); return sale;
  }
  const db = connection!;
  await db.execute("BEGIN TRANSACTION");
  try {
    await db.run("INSERT INTO sales (id,invoice,subtotal,discount,total,paid,change_amount,created_at) VALUES (?,?,?,?,?,?,?,?)",
      [sale.id,sale.invoice,sale.subtotal,sale.discount,sale.total,sale.paid,sale.change,sale.createdAt]);
    for (const item of items) {
      const result = await db.run("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?", [item.quantity,item.productId,item.quantity]);
      if (result.changes?.changes === 0) throw new Error(`Stok ${item.name} tidak mencukupi.`);
      await db.run("INSERT INTO sale_items (id,sale_id,product_id,name,price,quantity,line_total) VALUES (?,?,?,?,?,?,?)",
        [crypto.randomUUID(),sale.id,item.productId,item.name,item.price,item.quantity,item.lineTotal]);
    }
    await db.execute("COMMIT");
    return sale;
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}
export async function getSales(): Promise<Sale[]> {
  if (webMode) return readWeb().sales;
  const r = await connection!.query("SELECT * FROM sales ORDER BY created_at DESC");
  const sales = (r.values ?? []) as any[];
  const result: Sale[] = [];
  for (const s of sales) {
    const items = await connection!.query("SELECT product_id AS productId,name,price,quantity,line_total AS lineTotal FROM sale_items WHERE sale_id=?", [s.id]);
    result.push({ id:s.id,invoice:s.invoice,subtotal:s.subtotal,discount:s.discount,total:s.total,paid:s.paid,change:s.change_amount,createdAt:s.created_at,items:(items.values??[]) as SaleItem[] });
  }
  return result;
}

import { z } from "zod";
const id = z.number().int().positive();
const money = z.number().int().min(0).max(100000000);
const text = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((v) => !/[<>\x00-\x1f]/.test(v), "No se permite marcado HTML");
export const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("order"),
    tableId: id,
    expectedOrderId: id.nullable(),
    items: z
      .array(
        z.object({
          productId: id,
          quantity: z.number().int().min(1).max(50),
          note: z
            .string()
            .trim()
            .max(200)
            .refine((v) => !/[<>\x00-\x1f]/.test(v)),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({ action: z.literal("ready"), orderId: id }),
  z.object({
    action: z.literal("pay"),
    orderId: id,
    method: z.enum(["CASH", "CARD", "TRANSFER"]),
    tip: z.boolean(),
    tendered: money,
  }),
  z.object({ action: z.literal("open"), initial: money }),
  z.object({ action: z.literal("close"), counted: money }),
  z.object({
    action: z.literal("product"),
    id: id.optional(),
    name: text,
    category: z.enum(["Entradas", "Platos Fuertes", "Bebidas", "Postres"]),
    price: money,
    stock: z.number().int().min(0).max(100000),
    active: z.boolean(),
  }),
  z.object({ action: z.literal("delete"), id }),
  z.object({
    action: z.literal("expense"),
    description: text,
    amount: money.refine((v) => v > 0),
  }),
  z.object({ action: z.literal("tax"), tax: z.number().int().min(0).max(30) }),
  z.object({ action: z.literal("cancel"), orderId: id }),
]);

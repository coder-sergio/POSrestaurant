# mesa. · Restaurant OS

POS para restaurante en español: Next.js App Router, TypeScript, Tailwind CSS, Lucide, Zod y SQLite local. No requiere un servicio de base de datos externo. Requiere **Node.js 24 o superior**; usa `node:sqlite` (API todavía experimental en Node 24).

## Instalar y ejecutar

```bash
git clone https://github.com/coder-sergio/POSrestaurant.git
cd POSrestaurant
npm ci
cp .env.example .env.local
# Edita SEED_PASSWORD en .env.local: una contraseña única de al menos 12 caracteres.
node --env-file=.env.local --experimental-strip-types scripts/seed.ts
npm run dev
```

Abre http://localhost:3000. Las tres cuentas usan la contraseña que configuraste en el seed:

| Cuenta            | Rol           |
| ----------------- | ------------- |
| mesero@mesa.local | Mesero        |
| caja@mesa.local   | Cajero        |
| admin@mesa.local  | Administrador |

El botón de salida permite cambiar de cuenta; siempre requiere autenticación. El seed es idempotente y **no cambia contraseñas de usuarios existentes**. Para reiniciar exclusivamente una demostración, detén el servidor y elimina `data/` antes de repetir el seed; esto borra todos sus datos. No lo hagas en operación real.

```bash
npm test          # pruebas reales de permisos, stock, rollback, cobro y validación
node --env-file=.env.local scripts/smoke.mjs # servidor iniciado: crea una venta de prueba
npm run build    # compilación y comprobación TypeScript
npm start        # servidor de producción después de build
```

En producción usa HTTPS: las cookies de sesión son Secure. Mantén `data/` en disco persistente, con acceso restringido, y realiza copias de seguridad consistentes de SQLite (incluido el WAL, o mediante la API de backup de SQLite). No despliegues esta base local en una plataforma con disco efímero o varias réplicas independientes.

## Flujo de trabajo

- **Mesero:** selecciona mesa, busca por categoría, agrega cantidades y notas; envía a cocina para guardar la comanda y reservar stock. Puede ampliar un pedido abierto. Solicitar cobro bloquea nuevas líneas.
- **Cajero:** abre su propia caja, cobra cuentas pendientes, configura propina voluntaria, registra efectivo/tarjeta/transferencia, calcula cambio y visualiza/imprime recibo. El cierre registra efectivo esperado, contado y diferencia. Solo puede consultar sus turnos.
- **Administrador:** controla las vistas anteriores, KPIs diarios, ventas por hora, CRUD de menú, disponibilidad, impuesto y gastos. Puede anular pedidos **sin cobrar**, devolviendo stock. Los platos con historial se desactivan en lugar de eliminarse.

Moneda: COP, montos en pesos enteros. Impuesto inicial: 8%, configurable entre 0–30%; propina voluntaria: 10% del subtotal. Los KPIs usan fecha UTC del servidor. El balance mostrado incluye impuestos/propinas y no representa utilidad neta.

## Integridad y seguridad

Contraseñas bcrypt (factor 12), tokens de sesión aleatorios de 256 bits, hash de tokens en SQLite, cookies HttpOnly/SameSite Strict, expiración de 8 horas y revocación al salir. Limitación persistente de intentos de login por cuenta. Validación Zod en cliente y servidor; React escapa el contenido y se rechaza marcado en nombres/notas. Consultas parametrizadas, comprobación de origen contra CSRF, cabeceras de seguridad. La página autenticada comprueba la sesión en servidor y **cada API** vuelve a comprobarla; RBAC no depende de ocultar botones. Los datos financieros no se devuelven al mesero.

SQLite WAL, claves foráneas y `BEGIN IMMEDIATE` serializan mutaciones: el pedido reserva producto e ingredientes preparado por porción de forma atómica; el cobro registra ingreso, turno y cierre del pedido juntos. Si falla una línea, se revierte todo. Un índice único evita cobrar dos veces; otro impide dos cuentas abiertas para una mesa. El identificador esperado del pedido rechaza pantallas desactualizadas. El registro `audit` guarda actor y operación. No se guardan números de tarjeta.

La actualización automática cada 15 segundos mejora disponibilidad visible; el servidor verifica stock dentro de la transacción en cada envío. Los errores de red conservan la pantalla y muestran reintento; el Error Boundary protege errores de renderizado. Si se pierde la respuesta a una operación, actualiza y revisa la cuenta antes de repetirla.

## Estructura

```text
app/
  layout.tsx, globals.css     Diseño global
  page.tsx                   Guardia de sesión del servidor
  workspace.tsx              Mesas, pedidos, caja, recibos, dashboard y menú
  error.tsx                  Error Boundary y recuperación
  login/page.tsx             Autenticación y selección de cuenta
  api/login/route.ts         Login, bcrypt y limitación de intentos
  api/logout/route.ts        Revocación de sesión
  api/pos/route.ts           API autenticada y comprobación de origen
lib/
  auth.ts                    Sesiones y protección CSRF
  db.ts                      Esquema SQLite, transacciones y seed
  schema.ts                  Validación compartida
  pos.ts                     Reglas RBAC, inventario y caja
tests/pos.test.ts             Pruebas de dominio con DB aislada
scripts/seed.ts               Inicialización idempotente
data/                        SQLite y WAL (ignorado en Git)
```

## Alcance y extensiones

El seed incluye 12 mesas, 8 platos, cuentas para los 3 roles, una venta previa, un gasto y una mesa ocupada. Las recetas iniciales usan una porción preparada por plato; la tabla `recipes` soporta múltiples ingredientes y el motor verifica cada ingrediente, pero esta versión administra disponibilidad por porciones desde el menú, sin editor de recetas complejas.

La comanda se simula mediante registro persistente y confirmación visual; no hay integración con impresora de cocina. Tarjeta/transferencia registran un pago ya aprobado externamente, sin procesarlo. El recibo no es una factura electrónica ni incluye integración DIAN. No hay anulación/reembolso de ventas ya cobradas: requiere un flujo contable separado. Las cuentas iniciales son de demostración, sin gestión de usuarios o recuperación de contraseña. Antes de operar con personal real, añade administración de usuarios, cuentas individuales, recuperación y una política de copias de seguridad. Esta implementación tiene controles verificables, no constituye una auditoría integral de OWASP.

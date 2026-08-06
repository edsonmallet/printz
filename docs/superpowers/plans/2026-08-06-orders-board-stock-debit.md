# Board Kanban + Débito de Estoque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a drag-and-drop kanban board view to the Pedidos page, and automatic stock debit (via a Server Action) when a card enters a column marked as the production-entry column.

**Architecture:** `kanbanColumns` gets a new `isProductionEntry` boolean (admin-editable). `orders` gets a new `stockDebited` boolean, set `false` at creation and flipped once by the debit action. A new Server Action (`debit-stock.action.ts`, Admin SDK, same pattern as `invite-member.action.ts`) runs a Firestore transaction that decrements material stock, writes `stockMovements` docs, and marks the order debited — called from the client after a successful drag-drop into a production-entry column. The board itself is a small `@dnd-kit/core` component reusing `useOrders`/`useKanbanColumns`/`usePrinters`. The Pedidos page gets a Lista/Board tab toggle.

**Tech Stack:** Next.js Server Actions (Admin SDK, `firebase-admin`), `@dnd-kit/core` (new dependency), Firestore client SDK, TanStack Query, Zod, shadcn/ui (Tabs, Switch, Badge), Vitest.

## Global Constraints

- Schema (collections, fields, functions) in English; UI text in Portuguese.
- Biome only; `noUnusedVariables: error`.
- Privileged/cross-permission writes (stock debit touches `materials`, which is `admin`-write-only in Firestore rules, on behalf of any `member`) go through a Server Action with Admin SDK — never a client-side Firestore transaction. This mirrors `src/modules/team/services/invite-member.action.ts`: receive `idToken`, verify with `getAdminAuth().verifyIdToken`, extract `tenantId` from the decoded claim, use `getAdminFirestore()` (bypasses rules).
- `stockMovements` Firestore rule: `read: isMember`, `write: if false` (client never writes it directly — same pattern as `pendingInvites`).
- Debit is idempotent: a transaction check on `order.stockDebited` before writing, not a client-side pre-check, is what prevents double-debit.
- No `statusHistory`, no partners, no reordering within a kanban column in this plan.
- `npm test` runs `vitest run`; the `tests/firestore-rules/tenant-isolation.test.ts` suite cannot execute in this sandbox (no Firestore emulator — Java 21 unavailable) — this is a known, pre-existing environment limitation, not a defect to chase. Confirm other suites pass and the new rules-test code is well-formed.
- Lint via `./node_modules/.bin/biome check <paths>` if `npx biome`/`npm run lint` misbehaves in the sandbox (seen in prior plans on this repo).

---

### Task 1: Types, Firestore rules, dnd-kit dependency

**Files:**
- Modify: `src/shared/types/order.ts`
- Modify: `src/shared/types/kanban-column.ts`
- Modify: `firestore.rules`
- Modify: `tests/firestore-rules/tenant-isolation.test.ts`
- Modify: `package.json` (via `npm install`)

**Interfaces:**
- Produces: `Order.stockDebited: boolean`, `KanbanColumn.isProductionEntry: boolean`.

- [ ] **Step 1: Add `stockDebited` to the `Order` type**

In `src/shared/types/order.ts`, add the field to the `Order` interface:
```ts
export interface Order {
  customer?: { name: string; contact: string };
  items: OrderItem[];
  dueDate: number;
  statusId: string;
  assignedPrinterId: string;
  partnerId: null;
  stockDebited: boolean;
  createdAt: number;
  updatedAt: number;
}
```
(Insert `stockDebited: boolean;` right before `createdAt`.)

- [ ] **Step 2: Add `isProductionEntry` to the `KanbanColumn` type**

In `src/shared/types/kanban-column.ts`:
```ts
export interface KanbanColumn {
  name: string;
  order: number;
  isProductionEntry: boolean;
}
```

- [ ] **Step 3: Add the `stockMovements` Firestore rule**

In `firestore.rules`, inside `match /tenants/{tenantId}`, right after the `kanbanColumns` block, add:
```
match /stockMovements/{movementId} {
  allow read: if isMember(tenantId);
  allow write: if false;
}
```

- [ ] **Step 4: Write the new rules tests**

Append to `tests/firestore-rules/tenant-isolation.test.ts`, right before the closing `});` of the `describe("tenant isolation", ...)` block:
```ts
  it("member can read tenant stockMovements", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("stockMovements")
        .doc("movement-1")
        .set({ materialId: "pla-branco", type: "out", quantityG: 100 });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("stockMovements").get(),
    );
  });

  it("no client (including admin) can write tenant stockMovements", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertFails(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("stockMovements")
        .doc("movement-1")
        .set({ materialId: "pla-branco", type: "out", quantityG: 100 }),
    );
  });
```

- [ ] **Step 5: Run the rules tests (best-effort — emulator unavailable in this sandbox)**

Run: `npx vitest run tests/firestore-rules/tenant-isolation.test.ts`
Expected: the suite fails to start with a Firestore-emulator-connection error (pre-existing, known limitation) — confirm the failure is that connection error and not a syntax/parse error in your new test code (a parse error would show as a different kind of failure, e.g. an "Unexpected token" or import error, before the emulator connection is even attempted).

- [ ] **Step 6: Install `@dnd-kit/core`**

Run: `npm install @dnd-kit/core`
Expected: `package.json`/`package-lock.json` gain the new dependency, no errors.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test`
Expected: all suites pass except the firestore-rules suite (known emulator limitation).

```bash
git add src/shared/types/order.ts src/shared/types/kanban-column.ts firestore.rules tests/firestore-rules/tenant-isolation.test.ts package.json package-lock.json
git commit -m "feat: add stockDebited/isProductionEntry fields, stockMovements rules, dnd-kit dependency"
```

---

### Task 2: `isProductionEntry` on kanban columns (schema + form UI)

**Files:**
- Modify: `src/modules/kanban-columns/services/kanban-columns.schema.ts`
- Modify: `tests/kanban-columns/kanban-columns.schema.test.ts`
- Modify: `src/modules/kanban-columns/components/kanban-column-form-dialog.tsx`

**Interfaces:**
- Consumes: `KanbanColumn` from `@/shared/types/kanban-column` (Task 1, now has `isProductionEntry: boolean`).
- Produces: `kanbanColumnSchema` now validates/requires `isProductionEntry: boolean`; `KanbanColumnInput` includes it.

- [ ] **Step 1: Write the failing schema test**

Add to `tests/kanban-columns/kanban-columns.schema.test.ts` (inside the existing `describe("kanbanColumnSchema", ...)` block):
```ts
  it("aceita isProductionEntry true", () => {
    const result = kanbanColumnSchema.safeParse({
      name: "Em fila de impressão",
      order: 1,
      isProductionEntry: true,
    });
    expect(result.success).toBe(true);
  });

  it("assume isProductionEntry false por padrão quando omitido", () => {
    const result = kanbanColumnSchema.safeParse({ name: "A produzir", order: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isProductionEntry).toBe(false);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kanban-columns/kanban-columns.schema.test.ts`
Expected: FAIL — `result.data.isProductionEntry` is `undefined`, not `false` (the field doesn't exist in the schema yet).

- [ ] **Step 3: Update the schema**

In `src/modules/kanban-columns/services/kanban-columns.schema.ts`:
```ts
import { z } from "zod";

export const kanbanColumnSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  order: z.coerce.number().min(0, "Ordem não pode ser negativa"),
  isProductionEntry: z.boolean().default(false),
});

export type KanbanColumnInput = z.infer<typeof kanbanColumnSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kanban-columns/kanban-columns.schema.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Add the Switch field to the form dialog**

In `src/modules/kanban-columns/components/kanban-column-form-dialog.tsx`:

1. Add `isProductionEntry: false` to `emptyValues`:
```ts
const emptyValues: KanbanColumnInput = { name: "", order: 0, isProductionEntry: false };
```

2. Add the `Switch` import:
```ts
import { Switch } from "@/components/ui/switch";
```

3. Add a new `FormField` for `isProductionEntry`, right after the existing `order` field, before `DialogFooter` — mirror the exact pattern used for `printConfig.supports` in `src/modules/products/components/product-form-dialog.tsx`:
```tsx
            <FormField
              control={form.control}
              name="isProductionEntry"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel>Coluna de entrada em produção</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
```

- [ ] **Step 6: Run the full suite, lint, commit**

Run: `npm test` (expect same pass/fail pattern as before — nothing new broken)
Run: `./node_modules/.bin/biome check src/modules/kanban-columns`
Expected: clean.

```bash
git add src/modules/kanban-columns/services/kanban-columns.schema.ts tests/kanban-columns/kanban-columns.schema.test.ts src/modules/kanban-columns/components/kanban-column-form-dialog.tsx
git commit -m "feat: add isProductionEntry field to kanban columns"
```

---

### Task 3: `stockDebited` on orders (schema + service + form)

**Files:**
- Modify: `src/modules/orders/services/orders.schema.ts`
- Modify: `tests/orders/orders.schema.test.ts`
- Modify: `src/modules/orders/services/orders.service.ts`
- Modify: `src/modules/orders/components/order-form-dialog.tsx`

**Interfaces:**
- Consumes: `Order` from `@/shared/types/order` (Task 1, now has `stockDebited: boolean`).
- Produces: `orderDocSchema` now validates `stockDebited: boolean`.

- [ ] **Step 1: Write the failing schema test**

Add to `tests/orders/orders.schema.test.ts` — a new `describe` block in the same file, after the existing `describe("orderFormSchema", ...)`:
```ts
import { orderDocSchema } from "@/modules/orders/services/orders.schema";

describe("orderDocSchema", () => {
  const validDoc = {
    items: [
      {
        productId: "prod-1",
        name: "Vaso",
        quantity: 2,
        materialId: "mat-1",
        totalWeightG: 100,
        totalPrintTimeH: 4,
      },
    ],
    dueDate: 1735689600000,
    statusId: "col-1",
    assignedPrinterId: "printer-1",
    partnerId: null,
    stockDebited: false,
    createdAt: 1735689600000,
    updatedAt: 1735689600000,
  };

  it("aceita um documento válido com stockDebited false", () => {
    const result = orderDocSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it("aceita stockDebited true", () => {
    const result = orderDocSchema.safeParse({ ...validDoc, stockDebited: true });
    expect(result.success).toBe(true);
  });

  it("rejeita documento sem stockDebited", () => {
    const { stockDebited, ...rest } = validDoc;
    const result = orderDocSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
```
(Add the `orderDocSchema` import to the existing import line if `orderFormSchema` is already imported from the same module — combine into one import statement rather than two.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/orders/orders.schema.test.ts`
Expected: FAIL — the first two new tests fail because `orderDocSchema` doesn't have `stockDebited` yet (extra unknown key is fine under default Zod object parsing, but the "rejeita documento sem stockDebited" test should currently pass already before your change since the field isn't required yet — after Step 3 it must fail for the *first two* tests before the fix, and continue to make sense after).

- [ ] **Step 3: Update `orderDocSchema`**

In `src/modules/orders/services/orders.schema.ts`, add `stockDebited: z.boolean(),` to `orderDocSchema` (not `orderFormSchema` — that one is for the RHF form input and doesn't need this field):
```ts
export const orderDocSchema = z.object({
  customer: z.object({ name: z.string(), contact: z.string() }).optional(),
  items: z.array(orderItemDocSchema),
  dueDate: z.number(),
  statusId: z.string(),
  assignedPrinterId: z.string(),
  partnerId: z.null(),
  stockDebited: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/orders/orders.schema.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: `createOrder` always sets `stockDebited: false`**

In `src/modules/orders/services/orders.service.ts`, `createOrder` already spreads `input` and adds `createdAt`/`updatedAt`. Since `input`'s type is `Omit<Order, "createdAt" | "updatedAt">`, and `Order` now requires `stockDebited`, callers must already supply it — no change needed in `orders.service.ts` itself (TypeScript will force the caller, `order-form-dialog.tsx`, to supply it — that's Step 6). Confirm this by running `npx tsc --noEmit` after Step 6 and seeing no errors.

- [ ] **Step 6: `order-form-dialog.tsx` sets `stockDebited` in `persistOrder`**

In `src/modules/orders/components/order-form-dialog.tsx`, find `persistOrder`'s `orderData` object construction:
```ts
const orderData: Omit<Order, "createdAt" | "updatedAt"> = {
  ...(values.customerName
    ? { customer: { name: values.customerName, contact: values.customerContact ?? "" } }
    : {}),
  items,
  dueDate: parseLocalDate(values.dueDate),
  statusId: values.statusId,
  assignedPrinterId: values.assignedPrinterId,
  partnerId: null,
};
```
Add `stockDebited` — `false` on create, preserved unchanged on edit (never reset an already-debited order back to `false`, and never let the edit form flip it to `true` — this field is only ever set by the debit action):
```ts
const orderData: Omit<Order, "createdAt" | "updatedAt"> = {
  ...(values.customerName
    ? { customer: { name: values.customerName, contact: values.customerContact ?? "" } }
    : {}),
  items,
  dueDate: parseLocalDate(values.dueDate),
  statusId: values.statusId,
  assignedPrinterId: values.assignedPrinterId,
  partnerId: null,
  stockDebited: order?.stockDebited ?? false,
};
```

- [ ] **Step 7: Run the full suite, typecheck, lint, commit**

Run: `npm test`
Run: `npx tsc --noEmit` (expect only the pre-existing, unrelated `src/app/layout.tsx` `LayoutProps` error, nothing new)
Run: `./node_modules/.bin/biome check src/modules/orders`
Expected: all clean / passing (aside from known pre-existing exceptions).

```bash
git add src/modules/orders/services/orders.schema.ts tests/orders/orders.schema.test.ts src/modules/orders/components/order-form-dialog.tsx
git commit -m "feat: add stockDebited field to orders schema and form"
```

---

### Task 4: `debit-stock.action.ts` Server Action

**Files:**
- Create: `src/modules/orders/services/debit-stock.action.ts`

**Interfaces:**
- Consumes: `getAdminAuth`, `getAdminFirestore` from `@/shared/services/firebase-admin` (existing); `Order`/`OrderItem` types from `@/shared/types/order` (Task 1).
- Produces: `debitStockForOrder(input: { idToken: string; orderId: string }): Promise<void>`.

- [ ] **Step 1: Implement the Server Action**

`src/modules/orders/services/debit-stock.action.ts`:
```ts
"use server";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/shared/services/firebase-admin";
import type { Order } from "@/shared/types/order";

interface DebitStockActionInput {
  idToken: string;
  orderId: string;
}

export async function debitStockForOrder(input: DebitStockActionInput): Promise<void> {
  const decoded = await getAdminAuth().verifyIdToken(input.idToken);
  const tenantId = decoded.tenantId as string | undefined;
  const uid = decoded.uid;

  if (!tenantId) {
    throw new Error("Usuário sem tenant associado");
  }

  const db = getAdminFirestore();
  const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(input.orderId);

  await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) {
      throw new Error(`Pedido ${input.orderId} não encontrado`);
    }

    const order = orderSnapshot.data() as Order;
    if (order.stockDebited) {
      return;
    }

    const now = Date.now();
    for (const item of order.items) {
      const materialRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("materials")
        .doc(item.materialId);
      transaction.update(materialRef, {
        currentStockG: FieldValue.increment(-item.totalWeightG),
      });

      const movementRef = db.collection("tenants").doc(tenantId).collection("stockMovements").doc();
      transaction.set(movementRef, {
        materialId: item.materialId,
        type: "out",
        quantityG: item.totalWeightG,
        source: `order:${input.orderId}`,
        createdAt: now,
        createdBy: uid,
      });
    }

    transaction.update(orderRef, { stockDebited: true });
  });
}
```

- [ ] **Step 2: Run the full suite, typecheck, lint, commit**

Run: `npm test` (no test file for this task — it's a Server Action requiring the Firestore emulator to exercise meaningfully, same limitation as the rules tests; no automated test is added here)
Run: `npx tsc --noEmit` (expect only the pre-existing `layout.tsx` error)
Run: `./node_modules/.bin/biome check src/modules/orders/services/debit-stock.action.ts`
Expected: clean.

```bash
git add src/modules/orders/services/debit-stock.action.ts
git commit -m "feat: add debitStockForOrder server action"
```

---

### Task 5: `order-card.tsx` + `orders-board.tsx` (dnd-kit)

**Files:**
- Create: `src/modules/orders/components/order-card.tsx`
- Create: `src/modules/orders/components/orders-board.tsx`

**Interfaces:**
- Consumes: `useOrders`, `OrderWithId`, `updateOrder` from `@/modules/orders/services/orders.service` (Task 3); `debitStockForOrder` from `@/modules/orders/services/debit-stock.action` (Task 4); `useKanbanColumns`, `KanbanColumnWithId` from `@/modules/kanban-columns/services/kanban-columns.service` (Task 2 — `KanbanColumnWithId` now includes `isProductionEntry`); `usePrinters` from `@/modules/printers/services/printers.service` (existing); `useAuth` from `@/shared/hooks/use-auth` (existing).
- Produces: `OrderCard({ order, printerName }: { order: OrderWithId; printerName: string })`; `OrdersBoard({ tenantId, onEdit }: { tenantId: string; onEdit: (order: OrderWithId) => void })`.

- [ ] **Step 1: Implement `order-card.tsx`**

`src/modules/orders/components/order-card.tsx`:
```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import type { OrderWithId } from "@/modules/orders/services/orders.service";

interface OrderCardProps {
  order: OrderWithId;
  printerName: string;
  onClick: () => void;
}

export function OrderCard({ order, printerName, onClick }: OrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <CardContent className="flex flex-col gap-1 p-3 text-sm">
        <span className="font-medium">{order.customer?.name ?? "—"}</span>
        <span className="text-muted-foreground">
          {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
        </span>
        <span className="text-muted-foreground">{printerName}</span>
        <span className="text-muted-foreground">
          {new Date(order.dueDate).toLocaleDateString("pt-BR")}
        </span>
      </CardContent>
    </Card>
  );
}
```

Check `src/components/ui/card.tsx` exports `Card` and `CardContent` before writing this — if the names differ, use the actual exported names from that file.

- [ ] **Step 2: Implement `orders-board.tsx`**

`src/modules/orders/components/orders-board.tsx`:
```tsx
"use client";

import { DndContext, type DragEndEvent, useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import { debitStockForOrder } from "@/modules/orders/services/debit-stock.action";
import { OrderCard } from "@/modules/orders/components/order-card";
import { type OrderWithId, updateOrder, useOrders } from "@/modules/orders/services/orders.service";
import {
  type KanbanColumnWithId,
  useKanbanColumns,
} from "@/modules/kanban-columns/services/kanban-columns.service";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { useAuth } from "@/shared/hooks/use-auth";

interface OrdersBoardProps {
  tenantId: string;
  onEdit: (order: OrderWithId) => void;
}

function BoardColumn({
  column,
  orders,
  printerName,
  onEdit,
}: {
  column: KanbanColumnWithId;
  orders: OrderWithId[];
  printerName: (id: string) => string;
  onEdit: (order: OrderWithId) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-64 flex-col gap-2 rounded-lg border p-2 ${isOver ? "bg-muted" : ""}`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{column.name}</span>
        <span className="text-xs text-muted-foreground">{orders.length}</span>
      </div>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          printerName={printerName(order.assignedPrinterId)}
          onClick={() => onEdit(order)}
        />
      ))}
    </div>
  );
}

export function OrdersBoard({ tenantId, onEdit }: OrdersBoardProps) {
  const { data: orders } = useOrders(tenantId);
  const { data: columns } = useKanbanColumns(tenantId);
  const { data: printers } = usePrinters(tenantId);
  const { user } = useAuth();

  function printerName(printerId: string) {
    return printers.find((p) => p.id === printerId)?.name ?? printerId;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const orderId = event.active.id as string;
    const newColumnId = event.over?.id as string | undefined;
    if (!newColumnId) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order || order.statusId === newColumnId) return;

    try {
      await updateOrder(tenantId, order.id, { ...order, statusId: newColumnId });

      const targetColumn = columns.find((c) => c.id === newColumnId);
      if (targetColumn?.isProductionEntry && user) {
        const idToken = await user.getIdToken();
        await debitStockForOrder({ idToken, orderId: order.id });
      }
    } catch {
      toast.error("Não foi possível mover o pedido");
    }
  }

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sortedColumns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            orders={orders.filter((order) => order.statusId === column.id)}
            printerName={printerName}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

Check `useOrders`'s `OrderWithId` shape includes `id`, `statusId`, `assignedPrinterId`, `items`, `customer`, `dueDate` before writing `OrderCard` — confirmed already true from Task 1/3's type. Check `updateOrder`'s signature (`tenantId, orderId, input: Omit<Order, "createdAt" | "updatedAt">`) matches the `{ ...order, statusId: newColumnId }` call — `order` is an `OrderWithId` (has `id` plus all `Order` fields), so spreading it into `Omit<Order, "createdAt"|"updatedAt">` carries an extra `id`/`createdAt`/`updatedAt` that TypeScript's structural typing will NOT reject on an object literal passed positionally to a typed parameter only if there's no excess-property-check trigger — since this is a variable (`order`), not an object literal, structural typing allows extra properties, so this compiles. Confirm with `tsc --noEmit` in Step 3.

- [ ] **Step 3: Run the full suite, typecheck, lint, commit**

Run: `npm test`
Run: `npx tsc --noEmit` (expect only the pre-existing `layout.tsx` error — if `order-card.tsx`'s `Card`/`CardContent` import doesn't match the real exports of `src/components/ui/card.tsx`, fix the import names now)
Run: `./node_modules/.bin/biome check src/modules/orders/components/order-card.tsx src/modules/orders/components/orders-board.tsx`
Expected: clean.

```bash
git add src/modules/orders/components/order-card.tsx src/modules/orders/components/orders-board.tsx
git commit -m "feat: add kanban board view for orders with drag-and-drop"
```

---

### Task 6: Wire Lista/Board toggle into the Pedidos page

**Files:**
- Modify: `src/modules/orders/components/orders-section.tsx`

**Interfaces:**
- Consumes: `OrdersBoard` (Task 5), `OrderList` (existing), `OrderFormDialog` (existing).

- [ ] **Step 1: Add the Tabs toggle**

Replace the contents of `src/modules/orders/components/orders-section.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFormDialog } from "@/modules/orders/components/order-form-dialog";
import { OrderList } from "@/modules/orders/components/order-list";
import { OrdersBoard } from "@/modules/orders/components/orders-board";
import type { OrderWithId } from "@/modules/orders/services/orders.service";

export function OrdersSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; order?: OrderWithId }>({ open: false });

  function handleEdit(order: OrderWithId) {
    setDialog({ open: true, order });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, order: undefined })}>Novo pedido</Button>
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <OrderList tenantId={tenantId} onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="board">
          <OrdersBoard tenantId={tenantId} onEdit={handleEdit} />
        </TabsContent>
      </Tabs>
      <OrderFormDialog
        tenantId={tenantId}
        order={dialog.order}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite, typecheck, lint, commit**

Run: `npm test`
Run: `npx tsc --noEmit` (expect only the pre-existing `layout.tsx` error)
Run: `./node_modules/.bin/biome check src/modules/orders/components/orders-section.tsx`
Expected: clean.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, log in, go to Pedidos. Expected: "Lista"/"Board" tabs appear; Board shows one column per kanban column with cards; dragging a card into a different column updates its status; dragging into a column marked "Coluna de entrada em produção" (set via Recursos e custos → Colunas → editar coluna) triggers the debit action and decrements the relevant material's `currentStockG` (visible in Recursos e custos → Materiais).

```bash
git add src/modules/orders/components/orders-section.tsx
git commit -m "feat: add Lista/Board tab toggle to Pedidos page"
```

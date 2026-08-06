# Pedidos + Colunas Kanban (CRUD base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the base CRUD for orders (`orders`) and configurable kanban columns (`kanbanColumns`), including stock validation at order creation, without the drag-and-drop board or stock debit (those are a future plan).

**Architecture:** Follows the existing module pattern (`modules/{name}/{services,components}`) used by `products`/`materials`/`printers`: Zod schema → Firestore-backed TanStack Query hook + CRUD functions → form dialog (React Hook Form) → list → section → page. Two new modules: `modules/kanban-columns/` and `modules/orders/`. Firestore security rules extended to cover both new collections, mirroring the existing per-collection rule tests.

**Tech Stack:** Next.js App Router, Firebase client SDK (Firestore `onSnapshot`), TanStack Query, React Hook Form + Zod (`zodResolver`), shadcn/ui (Dialog, Select, Table, Badge, AlertDialog, Form, Input, Button), Vitest, `@firebase/rules-unit-testing`.

## Global Constraints

- Schema (collections, fields, functions) in English; UI text in Portuguese (CLAUDE.md §"Convenção de nomenclatura").
- Biome only (no ESLint/Prettier); `noUnusedVariables: error` — no unused params/vars.
- Client SDK writes go straight to Firestore from `services/*.service.ts` (no Server Action needed here — orders/kanbanColumns are not privileged operations, same as products/materials/printers today).
- `partnerId` is always `null` on orders in this plan — partners module doesn't exist yet, field is not exposed in the form.
- Stock validation blocks order creation/edit by default; a checkbox lets the user force-create despite insufficient stock (CLAUDE.md §5).
- No stock debit (`stockMovements`), no `statusHistory`, no kanban board/drag-and-drop in this plan — deferred to the next plan.
- `npm test` runs `vitest run`; `npm run lint` (or equivalent configured script) must stay clean — check `package.json` for the exact lint script name before running.

---

### Task 1: Types + Firestore rules for `orders` and `kanbanColumns`

**Files:**
- Create: `src/shared/types/kanban-column.ts`
- Create: `src/shared/types/order.ts`
- Modify: `firestore.rules`
- Modify: `tests/firestore-rules/tenant-isolation.test.ts`

**Interfaces:**
- Produces: `KanbanColumn { name: string; order: number }`, `Order { customer?: { name: string; contact: string }; items: OrderItem[]; dueDate: number; statusId: string; assignedPrinterId: string; partnerId: null; createdAt: number; updatedAt: number }`, `OrderItem { productId: string; name: string; quantity: number; materialId: string; totalWeightG: number; totalPrintTimeH: number }`.

- [ ] **Step 1: Create the type files**

`src/shared/types/kanban-column.ts`:
```ts
export interface KanbanColumn {
  name: string;
  order: number;
}
```

`src/shared/types/order.ts`:
```ts
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  materialId: string;
  totalWeightG: number;
  totalPrintTimeH: number;
}

export interface Order {
  customer?: { name: string; contact: string };
  items: OrderItem[];
  dueDate: number;
  statusId: string;
  assignedPrinterId: string;
  partnerId: null;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 2: Add Firestore rules for the two new collections**

In `firestore.rules`, inside `match /tenants/{tenantId}` (right after the `products` block), add:
```
match /orders/{orderId} {
  allow read: if isMember(tenantId);
  allow write: if isMember(tenantId);
}

match /kanbanColumns/{columnId} {
  allow read: if isMember(tenantId);
  allow write: if isAdmin(tenantId);
}
```

- [ ] **Step 3: Write failing rules tests**

Append to `tests/firestore-rules/tenant-isolation.test.ts`, right before the closing `});` of the `describe("tenant isolation", ...)` block (after the "member of tenant A cannot write tenant B's products" test, before "no client can read or write pendingInvites"):
```ts
  it("member (non-admin) can write tenant orders", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertSucceeds(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1" }),
    );
  });

  it("member of tenant A cannot read tenant B's orders", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1" });
    });

    await assertFails(
      alice.firestore().collection("tenants").doc("tenant-b").collection("orders").get(),
    );
  });

  it("member (non-admin) cannot write tenant kanbanColumns", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("kanbanColumns")
        .doc("col-1")
        .set({ name: "A produzir", order: 0 }),
    );
  });

  it("admin can write tenant kanbanColumns", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertSucceeds(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("kanbanColumns")
        .doc("col-1")
        .set({ name: "A produzir", order: 0 }),
    );
  });

  it("member can read tenant kanbanColumns", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("kanbanColumns")
        .doc("col-1")
        .set({ name: "A produzir", order: 0 });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("kanbanColumns").get(),
    );
  });
```

Note: since Step 2 (rules) and Step 3 (tests) are both being added here, run the tests only after both are in place — there's no "fails first" step for rules changes the way there is for application code. Skip ahead to Step 4 to verify.

- [ ] **Step 4: Run the rules tests**

Run: `npx vitest run tests/firestore-rules/tenant-isolation.test.ts`
Expected: PASS (all tests, including the 5 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/kanban-column.ts src/shared/types/order.ts firestore.rules tests/firestore-rules/tenant-isolation.test.ts
git commit -m "feat: add orders and kanbanColumns types and firestore rules"
```

---

### Task 2: `kanban-columns` schema + service

**Files:**
- Create: `src/modules/kanban-columns/services/kanban-columns.schema.ts`
- Create: `src/modules/kanban-columns/services/kanban-columns.service.ts`
- Test: `tests/kanban-columns/kanban-columns.schema.test.ts`

**Interfaces:**
- Consumes: `KanbanColumn` from `@/shared/types/kanban-column` (Task 1).
- Produces: `kanbanColumnSchema`, `type KanbanColumnInput = z.infer<typeof kanbanColumnSchema>`; `useKanbanColumns(tenantId): { data: KanbanColumnWithId[] }`, `KanbanColumnWithId extends KanbanColumn { id: string }`, `createColumn(tenantId, input)`, `updateColumn(tenantId, columnId, input)`, `deleteColumn(tenantId, columnId)`, `seedDefaultColumns(tenantId): Promise<void>`.

- [ ] **Step 1: Write the failing schema test**

`tests/kanban-columns/kanban-columns.schema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { kanbanColumnSchema } from "@/modules/kanban-columns/services/kanban-columns.schema";

describe("kanbanColumnSchema", () => {
  it("aceita uma coluna válida", () => {
    const result = kanbanColumnSchema.safeParse({ name: "A produzir", order: 0 });
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const result = kanbanColumnSchema.safeParse({ name: "", order: 0 });
    expect(result.success).toBe(false);
  });

  it("rejeita order negativo", () => {
    const result = kanbanColumnSchema.safeParse({ name: "A produzir", order: -1 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kanban-columns/kanban-columns.schema.test.ts`
Expected: FAIL with a module-not-found error for `kanban-columns.schema`

- [ ] **Step 3: Implement the schema**

`src/modules/kanban-columns/services/kanban-columns.schema.ts`:
```ts
import { z } from "zod";

export const kanbanColumnSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  order: z.coerce.number().min(0, "Ordem não pode ser negativa"),
});

export type KanbanColumnInput = z.infer<typeof kanbanColumnSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kanban-columns/kanban-columns.schema.test.ts`
Expected: PASS

- [ ] **Step 5: Implement the service**

`src/modules/kanban-columns/services/kanban-columns.service.ts` (mirrors `printers.service.ts` exactly, plus `seedDefaultColumns`):
```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect } from "react";
import {
  type KanbanColumnInput,
  kanbanColumnSchema,
} from "@/modules/kanban-columns/services/kanban-columns.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { KanbanColumn } from "@/shared/types/kanban-column";

export interface KanbanColumnWithId extends KanbanColumn {
  id: string;
}

const DEFAULT_COLUMN_NAMES = ["A produzir", "Em fila de impressão", "Pronto", "Entregue"];

export function useKanbanColumns(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["kanban-columns", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "kanbanColumns"),
      (snapshot) => {
        const columns: KanbanColumnWithId[] = snapshot.docs.flatMap((docSnapshot) => {
          const result = kanbanColumnSchema.safeParse(docSnapshot.data());
          if (!result.success) {
            console.warn(
              `useKanbanColumns: documento tenants/${tenantId}/kanbanColumns/${docSnapshot.id} inválido, ignorando`,
              result.error,
            );
            return [];
          }
          return [{ id: docSnapshot.id, ...result.data }];
        });
        columns.sort((a, b) => a.order - b.order);
        queryClient.setQueryData(queryKey, columns);
      },
      (error) => {
        console.error(
          `useKanbanColumns: falha ao ouvir tenants/${tenantId}/kanbanColumns (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<KanbanColumnWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createColumn(tenantId: string, input: KanbanColumnInput): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "kanbanColumns"), input);
}

export async function updateColumn(
  tenantId: string,
  columnId: string,
  input: KanbanColumnInput,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "kanbanColumns", columnId), input);
}

export async function deleteColumn(tenantId: string, columnId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "kanbanColumns", columnId));
}

export async function seedDefaultColumns(tenantId: string): Promise<void> {
  const columnsRef = collection(firestore, "tenants", tenantId, "kanbanColumns");
  const existing = await getDocs(columnsRef);
  if (!existing.empty) return;

  const batch = writeBatch(firestore);
  DEFAULT_COLUMN_NAMES.forEach((name, order) => {
    batch.set(doc(columnsRef), { name, order });
  });
  await batch.commit();
}
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/kanban-columns/services tests/kanban-columns/kanban-columns.schema.test.ts
git commit -m "feat: add kanban-columns schema and service"
```

---

### Task 3: `kanban-columns` UI + wire into Recursos e custos

**Files:**
- Create: `src/modules/kanban-columns/components/kanban-column-form-dialog.tsx`
- Create: `src/modules/kanban-columns/components/kanban-column-list.tsx`
- Create: `src/modules/kanban-columns/components/kanban-columns-section.tsx`
- Modify: `src/modules/resources/components/resources-page-content.tsx`

**Interfaces:**
- Consumes: `useKanbanColumns`, `createColumn`, `updateColumn`, `deleteColumn`, `seedDefaultColumns`, `KanbanColumnWithId` from Task 2; `kanbanColumnSchema`, `KanbanColumnInput` from Task 2.
- Produces: `KanbanColumnsSection({ tenantId }: { tenantId: string })`.

- [ ] **Step 1: Implement the form dialog**

`src/modules/kanban-columns/components/kanban-column-form-dialog.tsx`:
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createColumn,
  type KanbanColumnWithId,
  updateColumn,
} from "@/modules/kanban-columns/services/kanban-columns.service";
import {
  type KanbanColumnInput,
  kanbanColumnSchema,
} from "@/modules/kanban-columns/services/kanban-columns.schema";

const emptyValues: KanbanColumnInput = { name: "", order: 0 };

interface KanbanColumnFormDialogProps {
  tenantId: string;
  column?: KanbanColumnWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KanbanColumnFormDialog({
  tenantId,
  column,
  open,
  onOpenChange,
}: KanbanColumnFormDialogProps) {
  const form = useForm<z.input<typeof kanbanColumnSchema>, unknown, KanbanColumnInput>({
    resolver: zodResolver(kanbanColumnSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou a coluna alvo muda
  useEffect(() => {
    if (open) {
      form.reset(column ?? emptyValues);
    }
  }, [open, column]);

  async function onSubmit(values: KanbanColumnInput) {
    try {
      if (column) {
        await updateColumn(tenantId, column.id, values);
        toast.success("Coluna atualizada");
      } else {
        await createColumn(tenantId, values);
        toast.success("Coluna criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a coluna");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{column ? "Editar coluna" : "Nova coluna"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : (field.value as number)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Implement the list**

`src/modules/kanban-columns/components/kanban-column-list.tsx`:
```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  deleteColumn,
  type KanbanColumnWithId,
  useKanbanColumns,
} from "@/modules/kanban-columns/services/kanban-columns.service";

interface KanbanColumnListProps {
  tenantId: string;
  onEdit: (column: KanbanColumnWithId) => void;
}

export function KanbanColumnList({ tenantId, onEdit }: KanbanColumnListProps) {
  const { data: columns } = useKanbanColumns(tenantId);
  const [pendingDelete, setPendingDelete] = useState<KanbanColumnWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteColumn(tenantId, pendingDelete.id);
      toast.success("Coluna excluída");
    } catch {
      toast.error("Não foi possível excluir a coluna");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((column) => (
            <TableRow key={column.id}>
              <TableCell>{column.name}</TableCell>
              <TableCell>{column.order}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(column)}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPendingDelete(column)}>
                    Excluir
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>
              Pedidos que estiverem nessa coluna não serão movidos automaticamente. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 3: Implement the section (with auto-seed on first empty load)**

`src/modules/kanban-columns/components/kanban-columns-section.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { KanbanColumnFormDialog } from "@/modules/kanban-columns/components/kanban-column-form-dialog";
import { KanbanColumnList } from "@/modules/kanban-columns/components/kanban-column-list";
import {
  type KanbanColumnWithId,
  seedDefaultColumns,
  useKanbanColumns,
} from "@/modules/kanban-columns/services/kanban-columns.service";

export function KanbanColumnsSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; column?: KanbanColumnWithId }>({
    open: false,
  });
  const { data: columns, isLoading } = useKanbanColumns(tenantId);
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (isLoading || hasSeeded.current || columns.length > 0) return;
    hasSeeded.current = true;
    seedDefaultColumns(tenantId);
  }, [isLoading, columns.length, tenantId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, column: undefined })}>Nova coluna</Button>
      </div>
      <KanbanColumnList tenantId={tenantId} onEdit={(column) => setDialog({ open: true, column })} />
      <KanbanColumnFormDialog
        tenantId={tenantId}
        column={dialog.column}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire the new tab into Recursos e custos**

Modify `src/modules/resources/components/resources-page-content.tsx`:
```diff
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { CostsSettingsForm } from "@/modules/costs-settings/components/costs-settings-form";
+import { KanbanColumnsSection } from "@/modules/kanban-columns/components/kanban-columns-section";
 import { MaterialsSection } from "@/modules/materials/components/materials-section";
 import { PrintersSection } from "@/modules/printers/components/printers-section";
 import { useTenant } from "@/shared/hooks/use-tenant";
@@
         <TabsList>
           <TabsTrigger value="materials">Materiais</TabsTrigger>
           <TabsTrigger value="printers">Impressoras</TabsTrigger>
           <TabsTrigger value="costs">Custos</TabsTrigger>
+          <TabsTrigger value="kanban-columns">Colunas</TabsTrigger>
         </TabsList>
@@
         <TabsContent value="costs">
           <CostsSettingsForm tenantId={tenantId} />
         </TabsContent>
+        <TabsContent value="kanban-columns">
+          <KanbanColumnsSection tenantId={tenantId} />
+        </TabsContent>
       </Tabs>
```

- [ ] **Step 5: Manual check**

Run: `npm run dev`, log in, go to Recursos e custos → aba "Colunas". Expected: 4 default columns appear automatically ("A produzir", "Em fila de impressão", "Pronto", "Entregue"); create/edit/delete work.

- [ ] **Step 6: Commit**

```bash
git add src/modules/kanban-columns/components src/modules/resources/components/resources-page-content.tsx
git commit -m "feat: add kanban columns CRUD UI with default seeding"
```

---

### Task 4: `stock-validation.ts` (pure function, TDD)

**Files:**
- Create: `src/modules/orders/services/stock-validation.ts`
- Test: `tests/orders/stock-validation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface StockValidationItem {
    materialId: string;
    totalWeightG: number;
  }
  interface StockValidationResult {
    materialId: string;
    required: number;
    available: number;
    sufficient: boolean;
  }
  function validateStock(
    items: StockValidationItem[],
    materials: Map<string, { currentStockG: number }>,
  ): StockValidationResult[]
  ```

- [ ] **Step 1: Write the failing tests**

`tests/orders/stock-validation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { validateStock } from "@/modules/orders/services/stock-validation";

describe("validateStock", () => {
  it("marca sufficient true quando estoque cobre o consumo", () => {
    const result = validateStock(
      [{ materialId: "pla-branco", totalWeightG: 100 }],
      new Map([["pla-branco", { currentStockG: 500 }]]),
    );
    expect(result).toEqual([
      { materialId: "pla-branco", required: 100, available: 500, sufficient: true },
    ]);
  });

  it("marca sufficient false quando estoque não cobre o consumo", () => {
    const result = validateStock(
      [{ materialId: "pla-branco", totalWeightG: 600 }],
      new Map([["pla-branco", { currentStockG: 500 }]]),
    );
    expect(result).toEqual([
      { materialId: "pla-branco", required: 600, available: 500, sufficient: false },
    ]);
  });

  it("soma consumo de itens diferentes que usam o mesmo material", () => {
    const result = validateStock(
      [
        { materialId: "pla-branco", totalWeightG: 200 },
        { materialId: "pla-branco", totalWeightG: 200 },
      ],
      new Map([["pla-branco", { currentStockG: 300 }]]),
    );
    expect(result).toEqual([
      { materialId: "pla-branco", required: 400, available: 300, sufficient: false },
    ]);
  });

  it("trata material desconhecido no mapa como estoque zero", () => {
    const result = validateStock(
      [{ materialId: "pla-verde", totalWeightG: 50 }],
      new Map(),
    );
    expect(result).toEqual([
      { materialId: "pla-verde", required: 50, available: 0, sufficient: false },
    ]);
  });

  it("retorna um resultado por material distinto, na ordem de primeira ocorrência", () => {
    const result = validateStock(
      [
        { materialId: "pla-branco", totalWeightG: 100 },
        { materialId: "pla-preto", totalWeightG: 50 },
      ],
      new Map([
        ["pla-branco", { currentStockG: 1000 }],
        ["pla-preto", { currentStockG: 1000 }],
      ]),
    );
    expect(result.map((r) => r.materialId)).toEqual(["pla-branco", "pla-preto"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/orders/stock-validation.test.ts`
Expected: FAIL with a module-not-found error for `stock-validation`

- [ ] **Step 3: Implement the function**

`src/modules/orders/services/stock-validation.ts`:
```ts
export interface StockValidationItem {
  materialId: string;
  totalWeightG: number;
}

export interface StockValidationResult {
  materialId: string;
  required: number;
  available: number;
  sufficient: boolean;
}

export function validateStock(
  items: StockValidationItem[],
  materials: Map<string, { currentStockG: number }>,
): StockValidationResult[] {
  const requiredByMaterial = new Map<string, number>();
  for (const item of items) {
    requiredByMaterial.set(
      item.materialId,
      (requiredByMaterial.get(item.materialId) ?? 0) + item.totalWeightG,
    );
  }

  return Array.from(requiredByMaterial.entries()).map(([materialId, required]) => {
    const available = materials.get(materialId)?.currentStockG ?? 0;
    return { materialId, required, available, sufficient: available >= required };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/orders/stock-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/orders/services/stock-validation.ts tests/orders/stock-validation.test.ts
git commit -m "feat: add pure stock validation function for orders"
```

---

### Task 5: `orders` schema + service

**Files:**
- Create: `src/modules/orders/services/orders.schema.ts`
- Create: `src/modules/orders/services/orders.service.ts`
- Test: `tests/orders/orders.schema.test.ts`

**Interfaces:**
- Consumes: `Order`, `OrderItem` from `@/shared/types/order` (Task 1).
- Produces:
  - `orderFormSchema` (RHF input schema) → `OrderFormInput = { customerName?: string; customerContact?: string; items: { productId: string; quantity: number }[]; dueDate: string; statusId: string; assignedPrinterId: string; forceCreate?: boolean }`
  - `orderDocSchema` (Firestore doc shape, matches `Order`)
  - `useOrders(tenantId): { data: OrderWithId[] }`, `OrderWithId extends Order { id: string }`
  - `createOrder(tenantId, input: Omit<Order, "createdAt" | "updatedAt">): Promise<void>`
  - `updateOrder(tenantId, orderId, input: Omit<Order, "createdAt" | "updatedAt">): Promise<void>`

- [ ] **Step 1: Write the failing schema tests**

`tests/orders/orders.schema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { orderFormSchema } from "@/modules/orders/services/orders.schema";

describe("orderFormSchema", () => {
  const validInput = {
    customerName: "Maria",
    customerContact: "11999999999",
    items: [{ productId: "prod-1", quantity: 2 }],
    dueDate: "2026-09-01",
    statusId: "col-1",
    assignedPrinterId: "printer-1",
  };

  it("aceita um pedido válido", () => {
    const result = orderFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("aceita sem dados de cliente (opcional)", () => {
    const { customerName, customerContact, ...rest } = validInput;
    const result = orderFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejeita items vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita quantity zero ou negativa", () => {
    expect(
      orderFormSchema.safeParse({
        ...validInput,
        items: [{ productId: "prod-1", quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      orderFormSchema.safeParse({
        ...validInput,
        items: [{ productId: "prod-1", quantity: -1 }],
      }).success,
    ).toBe(false);
  });

  it("rejeita dueDate vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, dueDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita statusId vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, statusId: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita assignedPrinterId vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, assignedPrinterId: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/orders/orders.schema.test.ts`
Expected: FAIL with a module-not-found error for `orders.schema`

- [ ] **Step 3: Implement the schemas**

`src/modules/orders/services/orders.schema.ts`:
```ts
import { z } from "zod";

export const orderItemFormSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),
  quantity: z.coerce.number().int().positive("Quantidade deve ser maior que zero"),
});

export const orderFormSchema = z.object({
  customerName: z.string().optional(),
  customerContact: z.string().optional(),
  items: z.array(orderItemFormSchema).min(1, "Adicione pelo menos um item"),
  dueDate: z.string().min(1, "Data de entrega obrigatória"),
  statusId: z.string().min(1, "Selecione uma coluna"),
  assignedPrinterId: z.string().min(1, "Selecione uma impressora"),
  forceCreate: z.boolean().optional(),
});

export type OrderFormInput = z.infer<typeof orderFormSchema>;

const orderItemDocSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number(),
  materialId: z.string(),
  totalWeightG: z.number(),
  totalPrintTimeH: z.number(),
});

export const orderDocSchema = z.object({
  customer: z.object({ name: z.string(), contact: z.string() }).optional(),
  items: z.array(orderItemDocSchema),
  dueDate: z.number(),
  statusId: z.string(),
  assignedPrinterId: z.string(),
  partnerId: z.null(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type OrderDocInput = z.infer<typeof orderDocSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/orders/orders.schema.test.ts`
Expected: PASS

- [ ] **Step 5: Implement the service**

`src/modules/orders/services/orders.service.ts` (mirrors `products.service.ts`):
```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect } from "react";
import { orderDocSchema } from "@/modules/orders/services/orders.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Order } from "@/shared/types/order";

export interface OrderWithId extends Order {
  id: string;
}

export function useOrders(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["orders", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "orders"),
      (snapshot) => {
        const orders: OrderWithId[] = snapshot.docs.flatMap((docSnapshot) => {
          const result = orderDocSchema.safeParse(docSnapshot.data());
          if (!result.success) {
            console.warn(
              `useOrders: documento tenants/${tenantId}/orders/${docSnapshot.id} inválido, ignorando`,
              result.error,
            );
            return [];
          }
          return [{ id: docSnapshot.id, ...result.data }];
        });
        queryClient.setQueryData(queryKey, orders);
      },
      (error) => {
        console.error(
          `useOrders: falha ao ouvir tenants/${tenantId}/orders (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<OrderWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createOrder(
  tenantId: string,
  input: Omit<Order, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(firestore, "tenants", tenantId, "orders"), {
    ...input,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateOrder(
  tenantId: string,
  orderId: string,
  input: Omit<Order, "createdAt" | "updatedAt">,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "orders", orderId), {
    ...input,
    updatedAt: Date.now(),
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/orders/services/orders.schema.ts src/modules/orders/services/orders.service.ts tests/orders/orders.schema.test.ts
git commit -m "feat: add orders schema and service"
```

---

### Task 6: `order-form-dialog` component

**Files:**
- Create: `src/modules/orders/components/order-form-dialog.tsx`

**Interfaces:**
- Consumes: `orderFormSchema`, `OrderFormInput` (Task 5); `createOrder`, `updateOrder`, `OrderWithId` (Task 5); `validateStock`, `StockValidationResult` (Task 4); `useKanbanColumns` (Task 2); `useProducts` from `@/modules/products/services/products.service` (existing); `usePrinters` from `@/modules/printers/services/printers.service` (existing); `useMaterials` from `@/modules/materials/services/materials.service` (existing).
- Produces: `OrderFormDialog({ tenantId, order, open, onOpenChange }: { tenantId: string; order?: OrderWithId; open: boolean; onOpenChange: (open: boolean) => void })`.

- [ ] **Step 1: Implement the component**

`src/modules/orders/components/order-form-dialog.tsx`:
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKanbanColumns } from "@/modules/kanban-columns/services/kanban-columns.service";
import { useMaterials } from "@/modules/materials/services/materials.service";
import {
  type OrderFormInput,
  orderFormSchema,
} from "@/modules/orders/services/orders.schema";
import { createOrder, type OrderWithId, updateOrder } from "@/modules/orders/services/orders.service";
import { type StockValidationResult, validateStock } from "@/modules/orders/services/stock-validation";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { useProducts } from "@/modules/products/services/products.service";
import type { Order, OrderItem } from "@/shared/types/order";

const emptyValues: OrderFormInput = {
  customerName: "",
  customerContact: "",
  items: [{ productId: "", quantity: 1 }],
  dueDate: "",
  statusId: "",
  assignedPrinterId: "",
  forceCreate: false,
};

function orderToFormValues(order: OrderWithId): OrderFormInput {
  return {
    customerName: order.customer?.name ?? "",
    customerContact: order.customer?.contact ?? "",
    items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    dueDate: new Date(order.dueDate).toISOString().slice(0, 10),
    statusId: order.statusId,
    assignedPrinterId: order.assignedPrinterId,
    forceCreate: false,
  };
}

interface OrderFormDialogProps {
  tenantId: string;
  order?: OrderWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderFormDialog({ tenantId, order, open, onOpenChange }: OrderFormDialogProps) {
  const { data: products } = useProducts(tenantId);
  const { data: printers } = usePrinters(tenantId);
  const { data: columns } = useKanbanColumns(tenantId);
  const { data: materials } = useMaterials(tenantId);
  const [insufficientStock, setInsufficientStock] = useState<StockValidationResult[] | null>(null);

  const form = useForm<z.input<typeof orderFormSchema>, unknown, OrderFormInput>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: emptyValues,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou o pedido alvo muda
  useEffect(() => {
    if (open) {
      form.reset(order ? orderToFormValues(order) : emptyValues);
      setInsufficientStock(null);
    }
  }, [open, order]);

  function buildOrderItems(values: OrderFormInput): OrderItem[] {
    return values.items.map((formItem) => {
      const product = products.find((p) => p.id === formItem.productId);
      if (!product) {
        throw new Error(`Produto ${formItem.productId} não encontrado`);
      }
      return {
        productId: product.id,
        name: product.name,
        quantity: formItem.quantity,
        materialId: product.materialId,
        totalWeightG: product.weightG * formItem.quantity,
        totalPrintTimeH: product.printTimeH * formItem.quantity,
      };
    });
  }

  async function persistOrder(values: OrderFormInput, items: OrderItem[]) {
    const orderData: Omit<Order, "createdAt" | "updatedAt"> = {
      ...(values.customerName
        ? { customer: { name: values.customerName, contact: values.customerContact ?? "" } }
        : {}),
      items,
      dueDate: new Date(values.dueDate).getTime(),
      statusId: values.statusId,
      assignedPrinterId: values.assignedPrinterId,
      partnerId: null,
    };

    try {
      if (order) {
        await updateOrder(tenantId, order.id, orderData);
        toast.success("Pedido atualizado");
      } else {
        await createOrder(tenantId, orderData);
        toast.success("Pedido criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o pedido");
    }
  }

  async function onSubmit(values: OrderFormInput) {
    let items: OrderItem[];
    try {
      items = buildOrderItems(values);
    } catch {
      toast.error("Um dos produtos selecionados não foi encontrado");
      return;
    }

    if (!values.forceCreate) {
      const materialsMap = new Map(materials.map((m) => [m.id, { currentStockG: m.currentStockG }]));
      const validation = validateStock(items, materialsMap);
      const insufficient = validation.filter((v) => !v.sufficient);
      if (insufficient.length > 0) {
        setInsufficientStock(insufficient);
        return;
      }
    }

    await persistOrder(values, items);
  }

  async function handleForceConfirm() {
    const values = form.getValues();
    const items = buildOrderItems(values);
    setInsufficientStock(null);
    await persistOrder(values, items);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{order ? "Editar pedido" : "Novo pedido"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato do cliente (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <FormLabel>Itens</FormLabel>
                {fields.map((fieldItem, index) => (
                  <div key={fieldItem.id} className="flex items-end gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              {...field}
                              value={Number.isNaN(field.value) ? "" : (field.value as number)}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => append({ productId: "", quantity: 1 })}
                >
                  Adicionar item
                </Button>
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de entrega</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="statusId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coluna</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma coluna" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignedPrinterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impressora</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma impressora" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {printers.map((printer) => (
                          <SelectItem key={printer.id} value={printer.id}>
                            {printer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!insufficientStock} onOpenChange={(open) => !open && setInsufficientStock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estoque insuficiente</AlertDialogTitle>
            <AlertDialogDescription>
              {insufficientStock?.map((v) => (
                <div key={v.materialId}>
                  Material {v.materialId}: necessário {v.required}g, disponível {v.available}g.
                </div>
              ))}
              Criar o pedido mesmo assim vai deixar o estoque negativo quando for debitado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceConfirm}>Criar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/orders/components/order-form-dialog.tsx
git commit -m "feat: add order form dialog with stock validation"
```

---

### Task 7: `order-list`, `orders-section`, page, route, nav

**Files:**
- Create: `src/modules/orders/components/order-list.tsx`
- Create: `src/modules/orders/components/orders-section.tsx`
- Create: `src/modules/orders/components/orders-page-content.tsx`
- Create: `src/app/(dashboard)/orders/page.tsx`
- Modify: `src/shared/components/dashboard-shell.tsx`

**Interfaces:**
- Consumes: `useOrders`, `OrderWithId` (Task 5); `useKanbanColumns`, `KanbanColumnWithId` (Task 2); `usePrinters`, `PrinterWithId` (existing); `OrderFormDialog` (Task 6).
- Produces: `OrdersPageContent()`.

- [ ] **Step 1: Implement the list**

`src/modules/orders/components/order-list.tsx`:
```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useKanbanColumns } from "@/modules/kanban-columns/services/kanban-columns.service";
import { type OrderWithId, useOrders } from "@/modules/orders/services/orders.service";
import { usePrinters } from "@/modules/printers/services/printers.service";

interface OrderListProps {
  tenantId: string;
  onEdit: (order: OrderWithId) => void;
}

export function OrderList({ tenantId, onEdit }: OrderListProps) {
  const { data: orders } = useOrders(tenantId);
  const { data: columns } = useKanbanColumns(tenantId);
  const { data: printers } = usePrinters(tenantId);

  function columnName(statusId: string) {
    return columns.find((c) => c.id === statusId)?.name ?? statusId;
  }

  function printerName(printerId: string) {
    return printers.find((p) => p.id === printerId)?.name ?? printerId;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Itens</TableHead>
          <TableHead>Entrega</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Impressora</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>{order.customer?.name ?? "—"}</TableCell>
            <TableCell>
              {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
            </TableCell>
            <TableCell>{new Date(order.dueDate).toLocaleDateString("pt-BR")}</TableCell>
            <TableCell>
              <Badge variant="secondary">{columnName(order.statusId)}</Badge>
            </TableCell>
            <TableCell>{printerName(order.assignedPrinterId)}</TableCell>
            <TableCell>
              <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
                Editar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Implement the section**

`src/modules/orders/components/orders-section.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OrderFormDialog } from "@/modules/orders/components/order-form-dialog";
import { OrderList } from "@/modules/orders/components/order-list";
import type { OrderWithId } from "@/modules/orders/services/orders.service";

export function OrdersSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; order?: OrderWithId }>({ open: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, order: undefined })}>Novo pedido</Button>
      </div>
      <OrderList tenantId={tenantId} onEdit={(order) => setDialog({ open: true, order })} />
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

- [ ] **Step 3: Implement the page content**

`src/modules/orders/components/orders-page-content.tsx`:
```tsx
"use client";

import { OrdersSection } from "@/modules/orders/components/orders-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function OrdersPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Pedidos</h1>
      <OrdersSection tenantId={tenantId} />
    </div>
  );
}
```

- [ ] **Step 4: Add the route**

`src/app/(dashboard)/orders/page.tsx`:
```tsx
import { OrdersPageContent } from "@/modules/orders/components/orders-page-content";

export default function OrdersPage() {
  return <OrdersPageContent />;
}
```

- [ ] **Step 5: Add the nav item**

Modify `src/shared/components/dashboard-shell.tsx`:
```diff
-import { LayoutDashboard, LogOut, Package, Users, Wrench } from "lucide-react";
+import { ClipboardList, LayoutDashboard, LogOut, Package, Users, Wrench } from "lucide-react";
@@
 const navItems = [
   { href: "/", label: "Início", icon: LayoutDashboard },
   { href: "/products", label: "Produtos", icon: Package },
+  { href: "/orders", label: "Pedidos", icon: ClipboardList },
   { href: "/team", label: "Time", icon: Users },
   { href: "/settings/resources", label: "Recursos e custos", icon: Wrench },
 ];
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS (all existing tests + the new ones from Tasks 1, 2, 4, 5)

- [ ] **Step 7: Manual check**

Run: `npm run dev`, log in, go to "Pedidos" in the sidebar. Expected: can create a pedido with 1+ items, picking product/quantity/impressora/coluna/data de entrega; if a material's stock is insufficient, an alert appears with a "Criar mesmo assim" option; editing an existing pedido reopens the form pre-filled.

- [ ] **Step 8: Commit**

```bash
git add src/modules/orders/components/order-list.tsx src/modules/orders/components/orders-section.tsx src/modules/orders/components/orders-page-content.tsx "src/app/(dashboard)/orders/page.tsx" src/shared/components/dashboard-shell.tsx
git commit -m "feat: add orders list, page, route and nav item"
```

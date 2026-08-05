# Materiais e Impressoras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD completo de materiais (com controle de estoque simples) e impressoras (perfil de custo), escopados por tenant, com UI numa página de abas em `/settings/resources`.

**Architecture:** Dois módulos irmãos (`modules/materials`, `modules/printers`) seguindo o padrão já estabelecido em `modules/team`: schema Zod reaproveitado no form via `zodResolver`, leitura via `onSnapshot` + `queryClient.setQueryData` (TanStack Query), escrita via client SDK direto (sem Server Action — não há lógica privilegiada, a Firestore Rule já restringe a `admin`). Um terceiro módulo, `modules/resources`, compõe os dois em abas (shadcn `Tabs`) numa única página.

**Tech Stack:** Next.js App Router, Firebase client SDK (`firebase/firestore`), TanStack Query, React Hook Form + `@hookform/resolvers/zod`, Zod, shadcn/ui (`Table`, `Dialog`, `AlertDialog`, `Tabs`, `Badge`, `Form`, `Input`, `Button`, `Textarea`), Vitest.

## Global Constraints

- Schema (coleções, campos, funções) em inglês; textos de UI em português — copiado de `CLAUDE.md` seção 10.
- Nunca escrever lógica de negócio, chamada a Firestore, ou estado complexo dentro de `app/` — cada `page.tsx` só importa e renderiza um componente de `modules/{module}/components`.
- Zustand não entra aqui — não há estado de UI local complexo o suficiente pra justificar (dialogs usam `useState` local no componente pai, é o padrão certo pra esse escopo).
- Firestore rules: leitura = qualquer membro do tenant; escrita = só `admin` do tenant (mesmo padrão de `settings/costs`, seção 6 do CLAUDE.md).
- Testes: `tests/**/*.test.ts` (vitest, `environment: "node"` — ver `vitest.config.ts`). Não colocar testes dentro de `src/`.

---

### Task 1: Firestore rules para `materials` e `printers`

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: regras `allow read: if isMember(tenantId)` / `allow write: if isAdmin(tenantId)` para `tenants/{tenantId}/materials/{materialId}` e `tenants/{tenantId}/printers/{printerId}`. Nenhuma outra task depende do conteúdo interno, só do fato de que essas coleções passam a ser leg gíveis/gravável por membro/admin.

- [ ] **Step 1: Adicionar os blocos de regra**

Em `firestore.rules`, dentro de `match /tenants/{tenantId}`, logo depois do bloco `match /settings/{settingsDoc}`, adicionar:

```
match /materials/{materialId} {
  allow read: if isMember(tenantId);
  allow write: if isAdmin(tenantId);
}

match /printers/{printerId} {
  allow read: if isMember(tenantId);
  allow write: if isAdmin(tenantId);
}
```

- [ ] **Step 2: Deploy das rules**

Run: `firebase deploy --only firestore:rules --project printz-1558b`
Expected: `✔ Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore rules for materials and printers"
```

---

### Task 2: Tipos compartilhados `Material` e `Printer`

**Files:**
- Create: `src/shared/types/resources.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Material {
    name: string;
    pricePerKg: number;
    defaultWasteRate: number;
    color: string;
    density: number;
    currentStockG: number;
    minStockG: number;
  }

  export interface Printer {
    name: string;
    acquisitionCost: number;
    usefulLifeHours: number;
    avgPowerKw: number;
    buildVolumeMm: { x: number; y: number; z: number };
    notes?: string;
  }
  ```
  Toda task seguinte que referencia `Material`/`Printer` importa deste arquivo.

- [ ] **Step 1: Criar o arquivo de tipos**

```ts
export interface Material {
  name: string;
  pricePerKg: number;
  defaultWasteRate: number;
  color: string;
  density: number;
  currentStockG: number;
  minStockG: number;
}

export interface Printer {
  name: string;
  acquisitionCost: number;
  usefulLifeHours: number;
  avgPowerKw: number;
  buildVolumeMm: { x: number; y: number; z: number };
  notes?: string;
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/resources.ts
git commit -m "feat: add Material and Printer shared types"
```

---

### Task 3: Schema Zod de material (com teste)

**Files:**
- Create: `src/modules/materials/services/materials.schema.ts`
- Test: `tests/materials/materials.schema.test.ts`

**Interfaces:**
- Consumes: nada (schema autocontido).
- Produces: `materialSchema` (ZodSchema) e `type MaterialInput = z.infer<typeof materialSchema>` — usados pelo form (Task 8) e pelo service (Task 6).

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { materialSchema } from "@/modules/materials/services/materials.schema";

describe("materialSchema", () => {
  const validInput = {
    name: "PLA Branco",
    pricePerKg: 89.9,
    defaultWasteRate: 0.05,
    color: "Branco",
    density: 1.24,
    currentStockG: 1000,
    minStockG: 200,
  };

  it("aceita um material válido", () => {
    const result = materialSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const result = materialSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita pricePerKg zero ou negativo", () => {
    expect(materialSchema.safeParse({ ...validInput, pricePerKg: 0 }).success).toBe(false);
    expect(materialSchema.safeParse({ ...validInput, pricePerKg: -1 }).success).toBe(false);
  });

  it("rejeita defaultWasteRate fora do intervalo 0-1", () => {
    expect(materialSchema.safeParse({ ...validInput, defaultWasteRate: -0.1 }).success).toBe(
      false,
    );
    expect(materialSchema.safeParse({ ...validInput, defaultWasteRate: 1.1 }).success).toBe(
      false,
    );
  });

  it("rejeita density zero ou negativa", () => {
    expect(materialSchema.safeParse({ ...validInput, density: 0 }).success).toBe(false);
  });

  it("rejeita currentStockG ou minStockG negativos", () => {
    expect(materialSchema.safeParse({ ...validInput, currentStockG: -1 }).success).toBe(false);
    expect(materialSchema.safeParse({ ...validInput, minStockG: -1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npx vitest run tests/materials/materials.schema.test.ts`
Expected: FAIL — `Cannot find module '@/modules/materials/services/materials.schema'`

- [ ] **Step 3: Implementar o schema**

```ts
import { z } from "zod";

export const materialSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  pricePerKg: z.coerce.number().positive("Preço deve ser maior que zero"),
  defaultWasteRate: z.coerce
    .number()
    .min(0, "Taxa de perda deve estar entre 0 e 1")
    .max(1, "Taxa de perda deve estar entre 0 e 1"),
  color: z.string().min(1, "Cor obrigatória"),
  density: z.coerce.number().positive("Densidade deve ser maior que zero"),
  currentStockG: z.coerce.number().min(0, "Estoque não pode ser negativo"),
  minStockG: z.coerce.number().min(0, "Estoque mínimo não pode ser negativo"),
});

export type MaterialInput = z.infer<typeof materialSchema>;
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `npx vitest run tests/materials/materials.schema.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/modules/materials/services/materials.schema.ts tests/materials/materials.schema.test.ts
git commit -m "feat: add material zod schema with validation tests"
```

---

### Task 4: Schema Zod de impressora (com teste)

**Files:**
- Create: `src/modules/printers/services/printers.schema.ts`
- Test: `tests/printers/printers.schema.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `printerSchema` e `type PrinterInput = z.infer<typeof printerSchema>` — usados pelo form (Task 9) e pelo service (Task 7).

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { printerSchema } from "@/modules/printers/services/printers.schema";

describe("printerSchema", () => {
  const validInput = {
    name: "Ender 3 V2",
    acquisitionCost: 1500,
    usefulLifeHours: 8000,
    avgPowerKw: 0.35,
    buildVolumeMm: { x: 220, y: 220, z: 250 },
    notes: "",
  };

  it("aceita uma impressora válida", () => {
    const result = printerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("aceita sem notes (opcional)", () => {
    const { notes, ...withoutNotes } = validInput;
    const result = printerSchema.safeParse(withoutNotes);
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(printerSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
  });

  it("rejeita acquisitionCost, usefulLifeHours ou avgPowerKw zero ou negativos", () => {
    expect(printerSchema.safeParse({ ...validInput, acquisitionCost: 0 }).success).toBe(false);
    expect(printerSchema.safeParse({ ...validInput, usefulLifeHours: -1 }).success).toBe(false);
    expect(printerSchema.safeParse({ ...validInput, avgPowerKw: 0 }).success).toBe(false);
  });

  it("rejeita buildVolumeMm com dimensão zero ou negativa", () => {
    const result = printerSchema.safeParse({
      ...validInput,
      buildVolumeMm: { x: 0, y: 220, z: 250 },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npx vitest run tests/printers/printers.schema.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar o schema**

```ts
import { z } from "zod";

export const printerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  acquisitionCost: z.coerce.number().positive("Custo de aquisição deve ser maior que zero"),
  usefulLifeHours: z.coerce.number().positive("Vida útil deve ser maior que zero"),
  avgPowerKw: z.coerce.number().positive("Potência média deve ser maior que zero"),
  buildVolumeMm: z.object({
    x: z.coerce.number().positive("Largura (X) deve ser maior que zero"),
    y: z.coerce.number().positive("Profundidade (Y) deve ser maior que zero"),
    z: z.coerce.number().positive("Altura (Z) deve ser maior que zero"),
  }),
  notes: z.string().optional(),
});

export type PrinterInput = z.infer<typeof printerSchema>;
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `npx vitest run tests/printers/printers.schema.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/modules/printers/services/printers.schema.ts tests/printers/printers.schema.test.ts
git commit -m "feat: add printer zod schema with validation tests"
```

---

### Task 5: `tsconfig`/verificação de path alias `@/`

**Files:** nenhum (apenas verificação — pular se já confirmado)

- [ ] **Step 1: Confirmar que `@/*` resolve pra `src/*`**

Run: `grep -A3 '"paths"' tsconfig.json`
Expected: `"@/*": ["./src/*"]` (ou equivalente). Se já for esse o caso — o que é esperado, já que `modules/team` usa o mesmo padrão de import — não é necessário nenhum ajuste. Esta task existe só pra deixar explícito que as tasks seguintes assumem esse alias; não precisa de commit.

---

### Task 6: Service + hook de materiais (CRUD)

**Files:**
- Create: `src/modules/materials/services/materials.service.ts`

**Interfaces:**
- Consumes: `Material` de `@/shared/types/resources` (Task 2), `MaterialInput`/`materialSchema` de `@/modules/materials/services/materials.schema` (Task 3), `firestore` de `@/shared/services/firebase-client`.
- Produces:
  - `interface MaterialWithId extends Material { id: string }`
  - `useMaterials(tenantId: string | undefined): UseQueryResult<MaterialWithId[]>`
  - `createMaterial(tenantId: string, input: MaterialInput): Promise<void>`
  - `updateMaterial(tenantId: string, materialId: string, input: MaterialInput): Promise<void>`
  - `deleteMaterial(tenantId: string, materialId: string): Promise<void>`

  Usados pelos componentes das Tasks 8 e 10.

- [ ] **Step 1: Implementar o service**

```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useEffect } from "react";
import type { MaterialInput } from "@/modules/materials/services/materials.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Material } from "@/shared/types/resources";

export interface MaterialWithId extends Material {
  id: string;
}

export function useMaterials(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["materials", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "materials"),
      (snapshot) => {
        const materials: MaterialWithId[] = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Material),
        }));
        queryClient.setQueryData(queryKey, materials);
      },
      (error) => {
        console.error(
          `useMaterials: falha ao ouvir tenants/${tenantId}/materials (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<MaterialWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createMaterial(tenantId: string, input: MaterialInput): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "materials"), input);
}

export async function updateMaterial(
  tenantId: string,
  materialId: string,
  input: MaterialInput,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "materials", materialId), input);
}

export async function deleteMaterial(tenantId: string, materialId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "materials", materialId));
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/modules/materials/services/materials.service.ts
git commit -m "feat: add materials CRUD service and useMaterials hook"
```

---

### Task 7: Service + hook de impressoras (CRUD)

**Files:**
- Create: `src/modules/printers/services/printers.service.ts`

**Interfaces:**
- Consumes: `Printer` de `@/shared/types/resources` (Task 2), `PrinterInput` de `@/modules/printers/services/printers.schema` (Task 4), `firestore` de `@/shared/services/firebase-client`.
- Produces:
  - `interface PrinterWithId extends Printer { id: string }`
  - `usePrinters(tenantId: string | undefined): UseQueryResult<PrinterWithId[]>`
  - `createPrinter(tenantId: string, input: PrinterInput): Promise<void>`
  - `updatePrinter(tenantId: string, printerId: string, input: PrinterInput): Promise<void>`
  - `deletePrinter(tenantId: string, printerId: string): Promise<void>`

  Usados pelos componentes das Tasks 9 e 11.

- [ ] **Step 1: Implementar o service**

```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useEffect } from "react";
import type { PrinterInput } from "@/modules/printers/services/printers.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Printer } from "@/shared/types/resources";

export interface PrinterWithId extends Printer {
  id: string;
}

export function usePrinters(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["printers", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "printers"),
      (snapshot) => {
        const printers: PrinterWithId[] = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Printer),
        }));
        queryClient.setQueryData(queryKey, printers);
      },
      (error) => {
        console.error(
          `usePrinters: falha ao ouvir tenants/${tenantId}/printers (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<PrinterWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createPrinter(tenantId: string, input: PrinterInput): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "printers"), input);
}

export async function updatePrinter(
  tenantId: string,
  printerId: string,
  input: PrinterInput,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "printers", printerId), input);
}

export async function deletePrinter(tenantId: string, printerId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "printers", printerId));
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/modules/printers/services/printers.service.ts
git commit -m "feat: add printers CRUD service and usePrinters hook"
```

---

### Task 8: Formulário de material (dialog, create + edit)

**Files:**
- Create: `src/modules/materials/components/material-form-dialog.tsx`

**Interfaces:**
- Consumes: `materialSchema`, `MaterialInput` (Task 3); `createMaterial`, `updateMaterial`, `MaterialWithId` (Task 6).
- Produces: `MaterialFormDialog` — componente React usado pela Task 10 (`MaterialsSection`):
  ```ts
  interface MaterialFormDialogProps {
    tenantId: string;
    material?: MaterialWithId; // undefined = modo criação
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
  export function MaterialFormDialog(props: MaterialFormDialogProps): JSX.Element;
  ```

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  type MaterialInput,
  materialSchema,
} from "@/modules/materials/services/materials.schema";
import {
  createMaterial,
  type MaterialWithId,
  updateMaterial,
} from "@/modules/materials/services/materials.service";

const emptyValues: MaterialInput = {
  name: "",
  pricePerKg: 0,
  defaultWasteRate: 0,
  color: "",
  density: 0,
  currentStockG: 0,
  minStockG: 0,
};

interface MaterialFormDialogProps {
  tenantId: string;
  material?: MaterialWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaterialFormDialog({
  tenantId,
  material,
  open,
  onOpenChange,
}: MaterialFormDialogProps) {
  const form = useForm<MaterialInput>({
    resolver: zodResolver(materialSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou o material alvo muda
  useEffect(() => {
    if (open) {
      form.reset(material ?? emptyValues);
    }
  }, [open, material]);

  async function onSubmit(values: MaterialInput) {
    try {
      if (material) {
        await updateMaterial(tenantId, material.id, values);
        toast.success("Material atualizado");
      } else {
        await createMaterial(tenantId, values);
        toast.success("Material criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o material");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material ? "Editar material" : "Novo material"}</DialogTitle>
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pricePerKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço por kg (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="density"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Densidade (g/cm³)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultWasteRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxa de perda padrão (0 a 1)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" max="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentStockG"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque atual (g)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minStockG"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque mínimo (g)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" {...field} />
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

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/modules/materials/components/material-form-dialog.tsx
git commit -m "feat: add material create/edit form dialog"
```

---

### Task 9: Formulário de impressora (dialog, create + edit)

**Files:**
- Create: `src/modules/printers/components/printer-form-dialog.tsx`

**Interfaces:**
- Consumes: `printerSchema`, `PrinterInput` (Task 4); `createPrinter`, `updatePrinter`, `PrinterWithId` (Task 7).
- Produces: `PrinterFormDialog`:
  ```ts
  interface PrinterFormDialogProps {
    tenantId: string;
    printer?: PrinterWithId;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
  export function PrinterFormDialog(props: PrinterFormDialogProps): JSX.Element;
  ```
  Usado pela Task 11 (`PrintersSection`).

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type PrinterInput,
  printerSchema,
} from "@/modules/printers/services/printers.schema";
import {
  createPrinter,
  type PrinterWithId,
  updatePrinter,
} from "@/modules/printers/services/printers.service";

const emptyValues: PrinterInput = {
  name: "",
  acquisitionCost: 0,
  usefulLifeHours: 0,
  avgPowerKw: 0,
  buildVolumeMm: { x: 0, y: 0, z: 0 },
  notes: "",
};

interface PrinterFormDialogProps {
  tenantId: string;
  printer?: PrinterWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrinterFormDialog({
  tenantId,
  printer,
  open,
  onOpenChange,
}: PrinterFormDialogProps) {
  const form = useForm<PrinterInput>({
    resolver: zodResolver(printerSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou a impressora alvo muda
  useEffect(() => {
    if (open) {
      form.reset(printer ?? emptyValues);
    }
  }, [open, printer]);

  async function onSubmit(values: PrinterInput) {
    try {
      if (printer) {
        await updatePrinter(tenantId, printer.id, values);
        toast.success("Impressora atualizada");
      } else {
        await createPrinter(tenantId, values);
        toast.success("Impressora criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a impressora");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{printer ? "Editar impressora" : "Nova impressora"}</DialogTitle>
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
              name="acquisitionCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo de aquisição (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="usefulLifeHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vida útil (horas)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avgPowerKw"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Potência média (kW)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="buildVolumeMm.x"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Largura X (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buildVolumeMm.y"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profundidade Y (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buildVolumeMm.z"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Altura Z (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
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

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/modules/printers/components/printer-form-dialog.tsx
git commit -m "feat: add printer create/edit form dialog"
```

---

### Task 10: Lista de materiais + composição da seção (create/edit/delete, alerta de estoque baixo)

**Files:**
- Create: `src/modules/materials/components/material-list.tsx`
- Create: `src/modules/materials/components/materials-section.tsx`

**Interfaces:**
- Consumes: `useMaterials`, `deleteMaterial`, `MaterialWithId` (Task 6); `MaterialFormDialog` (Task 8).
- Produces: `MaterialsSection` — componente usado pela Task 12 (`ResourcesPageContent`):
  ```ts
  export function MaterialsSection({ tenantId }: { tenantId: string }): JSX.Element;
  ```

- [ ] **Step 1: Implementar `material-list.tsx`**

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteMaterial,
  type MaterialWithId,
  useMaterials,
} from "@/modules/materials/services/materials.service";

interface MaterialListProps {
  tenantId: string;
  onEdit: (material: MaterialWithId) => void;
}

export function MaterialList({ tenantId, onEdit }: MaterialListProps) {
  const { data: materials } = useMaterials(tenantId);
  const [pendingDelete, setPendingDelete] = useState<MaterialWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteMaterial(tenantId, pendingDelete.id);
      toast.success("Material excluído");
    } catch {
      toast.error("Não foi possível excluir o material");
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
            <TableHead>Cor</TableHead>
            <TableHead>Preço/kg</TableHead>
            <TableHead>Estoque</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => (
            <TableRow key={material.id}>
              <TableCell>{material.name}</TableCell>
              <TableCell>{material.color}</TableCell>
              <TableCell>R$ {material.pricePerKg.toFixed(2)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{material.currentStockG} g</span>
                  {material.currentStockG < material.minStockG && (
                    <Badge variant="destructive">Estoque baixo</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(material)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDelete(material)}
                  >
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
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
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

- [ ] **Step 2: Implementar `materials-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MaterialFormDialog } from "@/modules/materials/components/material-form-dialog";
import { MaterialList } from "@/modules/materials/components/material-list";
import type { MaterialWithId } from "@/modules/materials/services/materials.service";

export function MaterialsSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; material?: MaterialWithId }>({
    open: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, material: undefined })}>
          Novo material
        </Button>
      </div>
      <MaterialList
        tenantId={tenantId}
        onEdit={(material) => setDialog({ open: true, material })}
      />
      <MaterialFormDialog
        tenantId={tenantId}
        material={dialog.material}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/modules/materials/components/material-list.tsx src/modules/materials/components/materials-section.tsx
git commit -m "feat: add material list with low-stock badge and CRUD actions"
```

---

### Task 11: Lista de impressoras + composição da seção (create/edit/delete)

**Files:**
- Create: `src/modules/printers/components/printer-list.tsx`
- Create: `src/modules/printers/components/printers-section.tsx`

**Interfaces:**
- Consumes: `usePrinters`, `deletePrinter`, `PrinterWithId` (Task 7); `PrinterFormDialog` (Task 9).
- Produces: `PrintersSection` — usado pela Task 12 (`ResourcesPageContent`):
  ```ts
  export function PrintersSection({ tenantId }: { tenantId: string }): JSX.Element;
  ```

- [ ] **Step 1: Implementar `printer-list.tsx`**

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deletePrinter,
  type PrinterWithId,
  usePrinters,
} from "@/modules/printers/services/printers.service";

interface PrinterListProps {
  tenantId: string;
  onEdit: (printer: PrinterWithId) => void;
}

export function PrinterList({ tenantId, onEdit }: PrinterListProps) {
  const { data: printers } = usePrinters(tenantId);
  const [pendingDelete, setPendingDelete] = useState<PrinterWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deletePrinter(tenantId, pendingDelete.id);
      toast.success("Impressora excluída");
    } catch {
      toast.error("Não foi possível excluir a impressora");
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
            <TableHead>Custo de aquisição</TableHead>
            <TableHead>Vida útil</TableHead>
            <TableHead>Volume de impressão</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {printers.map((printer) => (
            <TableRow key={printer.id}>
              <TableCell>{printer.name}</TableCell>
              <TableCell>R$ {printer.acquisitionCost.toFixed(2)}</TableCell>
              <TableCell>{printer.usefulLifeHours} h</TableCell>
              <TableCell>
                {printer.buildVolumeMm.x} x {printer.buildVolumeMm.y} x {printer.buildVolumeMm.z}{" "}
                mm
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(printer)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDelete(printer)}
                  >
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
            <AlertDialogTitle>Excluir impressora?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
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

- [ ] **Step 2: Implementar `printers-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PrinterFormDialog } from "@/modules/printers/components/printer-form-dialog";
import { PrinterList } from "@/modules/printers/components/printer-list";
import type { PrinterWithId } from "@/modules/printers/services/printers.service";

export function PrintersSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; printer?: PrinterWithId }>({
    open: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, printer: undefined })}>
          Nova impressora
        </Button>
      </div>
      <PrinterList
        tenantId={tenantId}
        onEdit={(printer) => setDialog({ open: true, printer })}
      />
      <PrinterFormDialog
        tenantId={tenantId}
        printer={dialog.printer}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/modules/printers/components/printer-list.tsx src/modules/printers/components/printers-section.tsx
git commit -m "feat: add printer list with CRUD actions"
```

---

### Task 12: Página `settings/resources` com abas

**Files:**
- Create: `src/modules/resources/components/resources-page-content.tsx`
- Create: `src/app/(dashboard)/settings/resources/page.tsx`

**Interfaces:**
- Consumes: `MaterialsSection` (Task 10), `PrintersSection` (Task 11), `useTenant` de `@/shared/hooks/use-tenant`.
- Produces: rota `/settings/resources` renderizada, ponto de entrada final desta feature — nenhuma task depende disto.

- [ ] **Step 1: Implementar `resources-page-content.tsx`**

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialsSection } from "@/modules/materials/components/materials-section";
import { PrintersSection } from "@/modules/printers/components/printers-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function ResourcesPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Materiais e impressoras</h1>
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="printers">Impressoras</TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <MaterialsSection tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="printers">
          <PrintersSection tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Implementar a rota**

```tsx
import { ResourcesPageContent } from "@/modules/resources/components/resources-page-content";

export default function ResourcesPage() {
  return <ResourcesPageContent />;
}
```

- [ ] **Step 3: Checar tipos e lint**

Run: `npx tsc --noEmit && npx biome check src/modules/materials src/modules/printers src/modules/resources src/shared/types/resources.ts src/app/\(dashboard\)/settings`
Expected: sem erros. Se o biome apontar formatação, rodar `npx biome format --write` nos arquivos listados e checar de novo.

- [ ] **Step 4: Rodar toda a suíte de testes**

Run: `npm test`
Expected: todos os testes passam, incluindo os novos de `materials.schema` e `printers.schema`.

- [ ] **Step 5: Teste manual no browser**

Run: `npm run dev`, logar como admin de um tenant, navegar pra `/settings/resources`, criar um material, editar, verificar badge de estoque baixo (definir `minStockG` maior que `currentStockG`), excluir, e repetir os mesmos passos na aba de impressoras.

- [ ] **Step 6: Commit**

```bash
git add src/modules/resources/components/resources-page-content.tsx "src/app/(dashboard)/settings/resources/page.tsx"
git commit -m "feat: add materials and printers resources page"
```

---

## Spec Coverage Check

- CRUD de materiais → Tasks 3, 6, 8, 10
- CRUD de impressoras → Tasks 4, 7, 9, 11
- Alerta de estoque baixo → Task 10 (badge `currentStockG < minStockG`)
- Página única com abas → Task 12
- Firestore rules (`admin` escreve, membro lê) → Task 1
- Testes unitários dos schemas → Tasks 3, 4
- `currentStockG` editável direto no form (sem `stockMovements` nesta etapa) → Task 8 (campo no form, sem lançamento de movimento)
- Exclusão sem checagem de uso (produtos não existem ainda) → Task 10, 11 (delete direto com confirmação, sem checagem de referência)
